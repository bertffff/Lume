-- Irreversible after publication. Run with old writers drained; see Task 2 runbook.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE "Room" IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE room_invite_assignments (
  room_id text PRIMARY KEY,
  code text NOT NULL UNIQUE
) ON COMMIT DROP;

DO $$
DECLARE
  -- Frozen copy of @lume/contracts ROOM_CODE_ALPHABET for this migration.
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  alphabet_size constant integer := length(alphabet);
  unbiased_ceiling constant integer := 256 - (256 % alphabet_size);
  room record;
  entropy bytea;
  candidate text;
  sample integer;
  assigned boolean;
BEGIN
  FOR room IN SELECT id, slug FROM "Room" ORDER BY id LOOP
    assigned := false;
    FOR attempt IN 1..64 LOOP
      -- The first six bytes of a v4 UUID contain no version/variant bits.
      entropy := uuid_send(gen_random_uuid());
      candidate := '';
      FOR idx IN 0..5 LOOP
        sample := get_byte(entropy, idx);
        EXIT WHEN sample >= unbiased_ceiling;
        candidate := candidate || substr(alphabet, 1 + (sample % alphabet_size), 1);
      END LOOP;
      CONTINUE WHEN length(candidate) <> 6 OR candidate = left(room.slug, 6);
      -- Never reissue a pre-existing canonical value, even if the source data
      -- contains an unexpectedly short slug. No aliases survive the update.
      CONTINUE WHEN EXISTS (SELECT 1 FROM "Room" WHERE slug = candidate);

      INSERT INTO room_invite_assignments (room_id, code) VALUES (room.id, candidate)
      ON CONFLICT (code) DO NOTHING;
      assigned := FOUND;
      EXIT WHEN assigned;
    END LOOP;
    IF NOT assigned THEN
      RAISE EXCEPTION 'Could not allocate a unique room invite; cutover aborted';
    END IF;
  END LOOP;
END $$;

UPDATE "Room" AS room SET slug = assigns.code
FROM room_invite_assignments AS assigns WHERE room.id = assigns.room_id;

-- Keep Room_slug_key and every FK unchanged. This validates the backfill and
-- rejects any stale eight-character writer before it can insert another room.
ALTER TABLE "Room" ADD CONSTRAINT "Room_slug_canonical_check"
  CHECK (slug COLLATE "C" ~ '^[abcdefghjkmnpqrstuvwxyz23456789]{6}$');

COMMIT;
