# Six-character room invite cutover

**Operator procedure; not authorization to deploy.** API, web, bot and the database migrate together. This is a hard cutover: published eight-character links are intentionally retired. There is no alias or prefix fallback. The stable identifier is `Room.id`; only `Room.slug` changes.

## Rehearse before scheduling

1. Validate the matched release artifacts (including the contracts build used by API and bot) and test the migration against a recent, access-controlled snapshot restored to an isolated PostgreSQL instance. Use PostgreSQL 16 as in the checked-in development stack. Record room/relationship integrity and migration duration; the SQL holds `ACCESS EXCLUSIVE` on `Room`, with a five-second lock acquisition cutoff. The rehearsal must fit the maintenance window.
2. Check ingress before cutover. The API uses the socket peer for the IP bucket and deliberately ignores arbitrary `X-Forwarded-For`. If traffic is proxied, validate real-client IP enforcement at trusted ingress, or arrange an explicit trusted-proxy configuration before release; otherwise the 12-per-minute API bucket is shared per proxy peer. Make sure replicas use the same Redis namespace and Redis is healthy. Production invite joins fail closed when Redis cannot enforce the budget. Configure web/ingress access logs and analytics not to record raw `/join/:code` paths or Telegram start parameters.
3. Rehearse recovery by restoring the pre-cutover backup into a clean, isolated database and verifying the pre-cutover format and relationships. Treat backups and any slug exports as invite secrets. Prefer no plaintext exports; record counts and equality checks, not codes.

## Apply while traffic is held

1. Block traffic to old invite readers and writers (including room creation and resume); drain old runtimes and in-flight work that accesses rooms. Keep new invite links unpublished. Take and verify a current recovery snapshot after the drain.
2. Apply `20261122090000_room_invite_cutover` through the normal Prisma migration workflow, using only the approved deployment target. The SQL prepares unique assignments in a temporary table under lock, then updates the corresponding rows by ID and installs `Room_slug_canonical_check` within the same transaction. The existing `Room_slug_key` stays in force. Any lock/assignment/error aborts the migration; do not generate codes by truncating the old values, use `db push`, or run an ad hoc partial update.
3. Before opening traffic, verify counts and constraints, and compare room IDs plus dependent records against the held snapshot; only the slug is expected to differ. For example, these queries emit no invite values:

   ```sql
   SELECT count(*) AS rooms,
          count(*) FILTER (WHERE slug COLLATE "C" !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{6}$') AS malformed,
          count(*) - count(DISTINCT slug) AS duplicates
   FROM "Room";

   SELECT convalidated FROM pg_constraint
   WHERE conrelid = '"Room"'::regclass AND conname = 'Room_slug_canonical_check';
   ```

   Expect zero malformed and duplicate rows, a validated constraint, and the same stable room IDs and relations. Include ended rooms in validation. For large datasets, use streaming, ordered comparisons using stable IDs on the snapshot and migrated target (ignore only `Room.slug`); do not dump sensitive row data to release logs.
4. Bring up only the coordinated API/web/bot versions while traffic is still held. Smoke test new creation/resume; canonical links from both browser and Telegram; keyboard/paste and sign-in continuation on web; rejection of old links with a recoverable home action; and unchanged access limits, bans and member permissions. Purge stale web/edge caches as applicable. Reopen traffic and publish new links only once all required consumers pass.

## Recovery

- **Before any publication or writes by the new release:** if migration did not commit, confirm data is still in the old format and inspect Prisma migration history before retrying or restoring service. If it committed but validation fails, keep traffic held. Restore the verified pre-cutover backup into a clean target (including Prisma migration history), verify its contents, then switch the matched old release to it only if you can establish that no new invite was published and no new writes would be lost. Do not reverse the SQL in place.
- **After a new link was published or a new write landed:** fix forward on the six-character data and preserve current assignments and stable IDs. Do not restore the pre-cutover database over current state, reassign good codes, or redeploy an eight-character resolver. If an outage requires database recovery, use a post-cutover backup/PITR and check invite assignments before reopening; coordinate incident and data-loss decisions explicitly.

## Isolated fixture

`packages/db/prisma/fixtures/invite-cutover-before.sql` seeds synthetic legacy rows. Apply the historical migrations up to (not including) the cutover on a uniquely named disposable PostgreSQL instance bound to an alternate loopback port, seed, dump, and restore identical copies for pre-cutover recovery and migration verification. Use an alternate loopback Redis instance when exercising the shared counters. To run the scoped fixture, set `LUME_INVITE_FIXTURE_DATABASE_URL` explicitly to `postgresql://…@127.0.0.1:<alternate>/lume_task2[_suffix]?schema=public`, optionally set `LUME_INVITE_FIXTURE_REDIS_URL` to `redis://127.0.0.1:<alternate>`, and run the API test with a separate Vitest config that has **no** `globalSetup`. Do not use the normal API Vitest config for this rehearsal: it recreates another database on the default PostgreSQL port. Restore a fresh fixture before each integration run.
