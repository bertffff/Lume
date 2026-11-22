BEGIN;

CREATE TYPE "RoomCategory" AS ENUM ('film', 'music', 'vlog', 'other');
CREATE TYPE "RoomCategorySelection" AS ENUM ('auto', 'film', 'music', 'vlog', 'other');

ALTER TABLE "Room"
  ADD COLUMN "category" "RoomCategory" NOT NULL DEFAULT 'other',
  ADD COLUMN "categorySelection" "RoomCategorySelection" NOT NULL DEFAULT 'auto';
ALTER TABLE "QueueItem" ADD COLUMN "inferredCategory" "RoomCategory" NOT NULL DEFAULT 'other';

-- Legacy rows only have the stored title and provider, not metadata-category
-- or channel. Mirror the deterministic rules for the stored title/provider/URL.
WITH signals AS (
  SELECT id, lower(provider) AS source,
    url ~* '^https?://([^/?#@]*@)?([a-z0-9-]+\.)*(soundcloud|bandcamp|spotify|deezer)\.com([:/?#]|$)' AS music_host,
    title ~* '(фильм|кино|сериал|movie|film|cinema|трейлер|trailer)' AS film,
    title ~* '(музык|песн|клип|music|song|альбом|album|концерт|concert)' AS music,
    title ~* '(влог|vlog|блог|blog)' AS vlog
  FROM "QueueItem"
)
UPDATE "QueueItem" AS item SET "inferredCategory" = (CASE
  WHEN film::int + music::int + vlog::int > 1 THEN 'other'
  WHEN film THEN 'film'
  WHEN music THEN 'music'
  WHEN vlog THEN 'vlog'
  WHEN music_host OR source IN ('soundcloud', 'bandcamp', 'spotify', 'deezer') THEN 'music'
  ELSE 'other'
END)::"RoomCategory"
FROM signals WHERE item.id = signals.id;

UPDATE "Room" AS room SET "category" = item."inferredCategory"
FROM "QueueItem" AS item WHERE room."nowPlayingId" = item.id AND room.id = item."roomId";

CREATE INDEX "Room_isPublic_createdAt_id_idx" ON "Room"("isPublic", "createdAt", "id");
CREATE INDEX "Room_isPublic_category_createdAt_id_idx" ON "Room"("isPublic", "category", "createdAt", "id");

COMMIT;
