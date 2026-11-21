-- Persistent upload metadata and stream URL expiry for F041.

ALTER TABLE "QueueItem" ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE TABLE "MediaObject" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "backend" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT,
    "telegramFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaObject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaObject_key_key" ON "MediaObject"("key");
CREATE INDEX "MediaObject_userId_idx" ON "MediaObject"("userId");

ALTER TABLE "MediaObject" ADD CONSTRAINT "MediaObject_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
