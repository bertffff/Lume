-- AlterEnum
CREATE TYPE "MemberRole_new" AS ENUM ('host', 'mod', 'viewer');
ALTER TABLE "RoomMember" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "RoomMember" ALTER COLUMN "role" TYPE "MemberRole_new" USING (
  CASE "role"::text
    WHEN 'member' THEN 'viewer'
    ELSE "role"::text
  END::"MemberRole_new"
);
ALTER TYPE "MemberRole" RENAME TO "MemberRole_old";
ALTER TYPE "MemberRole_new" RENAME TO "MemberRole";
DROP TYPE "MemberRole_old";
ALTER TABLE "RoomMember" ALTER COLUMN "role" SET DEFAULT 'viewer';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntitlementSource" ADD VALUE 'stars';
ALTER TYPE "EntitlementSource" ADD VALUE 'web';

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "nowPlayingId" TEXT;

-- AlterTable
ALTER TABLE "RoomMember" ADD COLUMN     "muted" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "role" SET DEFAULT 'viewer';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "replyToId" TEXT;

-- CreateTable
CREATE TABLE "QueueItem" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedById" TEXT NOT NULL,
    "played" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueueItem_roomId_position_idx" ON "QueueItem"("roomId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Room_nowPlayingId_key" ON "Room"("nowPlayingId");

-- CreateIndex
CREATE INDEX "Room_isPublic_createdAt_idx" ON "Room"("isPublic", "createdAt");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_nowPlayingId_fkey" FOREIGN KEY ("nowPlayingId") REFERENCES "QueueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueItem" ADD CONSTRAINT "QueueItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueItem" ADD CONSTRAINT "QueueItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

