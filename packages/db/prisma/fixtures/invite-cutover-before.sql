-- Synthetic fixture: run only before the invite migration on disposable PostgreSQL.
BEGIN;
INSERT INTO "User" (id, "displayName", "updatedAt") VALUES
  ('task2-host', 'Fixture host', now()), ('task2-banned', 'Fixture banned viewer', now());
INSERT INTO "Room" (id, slug, title, "hostId", "ownerId", status, layout, "defaultPermissions", "updatedAt") VALUES
  ('task2-room', '7kq2mxzz', 'Fixture room', 'task2-host', 'task2-host', 'live', '{}', '{"canInvite": false}', now()),
  ('task2-ended', '8kq2mxzz', 'Ended fixture room', 'task2-host', 'task2-host', 'ended', '{}', NULL, now());
INSERT INTO "RoomMember" (id, "roomId", "userId", role) VALUES ('task2-member', 'task2-room', 'task2-host', 'host');
INSERT INTO "Message" (id, "roomId", "userId", body) VALUES ('task2-message', 'task2-room', 'task2-host', 'Fixture message');
INSERT INTO "QueueItem" (id, "roomId", "addedById", url, provider, "externalId", title, position) VALUES
  ('task2-queue', 'task2-room', 'task2-host', 'https://example.com/fixture.mp4', 'direct', 'task2-media', 'Fixture media', 1);
UPDATE "Room" SET "nowPlayingId" = 'task2-queue' WHERE id = 'task2-room';
INSERT INTO "Ban" (id, "roomId", "userId", "ownerId") VALUES ('task2-ban', 'task2-room', 'task2-banned', 'task2-host');
COMMIT;
