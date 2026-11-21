CREATE TYPE "PlatformRole" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');
ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'email';
ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'push';

ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "bio" VARCHAR(100);
ALTER TABLE "User" ADD COLUMN "role" "PlatformRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "scheduledDeletionAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "xp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "totalParties" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "totalWatchTime" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "totalMessages" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "totalReactions" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "roomsCreated" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "onboardingComplete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "lastRoomSnapshot" JSONB;
ALTER TABLE "User" ADD COLUMN "lastRoomSnapshotAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "isFriendsPublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "isFavoriteVideosPublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "isTopFriendsPublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "isWatchHistoryPublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "showUsername" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "hideOtherReactions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "quickEmojis" JSONB;
ALTER TABLE "User" ADD COLUMN "quickReaction" TEXT NOT NULL DEFAULT '❤️';
ALTER TABLE "User" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "User" ADD COLUMN "isPremium" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_scheduledDeletionAt_idx" ON "User"("scheduledDeletionAt");

ALTER TABLE "Room" ADD COLUMN "ownerId" TEXT;
UPDATE "Room" SET "ownerId" = "hostId" WHERE "ownerId" IS NULL;
ALTER TABLE "Room" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "Room" ADD COLUMN "description" TEXT;
ALTER TABLE "Room" ADD COLUMN "maxMembers" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "Room" ADD COLUMN "hideReactions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Room" ADD COLUMN "defaultPermissions" JSONB;
ALTER TABLE "Room" ADD COLUMN "pinnedMessageId" TEXT;
ALTER TABLE "Room" ADD COLUMN "slowModeSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Room" ADD COLUMN "emptySince" TIMESTAMP(3);
ALTER TABLE "Room" ADD CONSTRAINT "Room_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoomMember" ADD COLUMN "mutedUntil" TIMESTAMP(3);
ALTER TABLE "RoomMember" ADD COLUMN "canChat" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RoomMember" ADD COLUMN "canSpeak" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RoomMember" ADD COLUMN "canControlVideo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RoomMember" ADD COLUMN "canAddToQueue" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RoomMember" ADD COLUMN "canRemoveFromQueue" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RoomMember" ADD COLUMN "canReorderQueue" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RoomMember" ADD COLUMN "permissionsOverridden" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Message" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "Message" ADD COLUMN "imageUrl" TEXT;

ALTER TABLE "Achievement" ADD COLUMN "icon" TEXT NOT NULL DEFAULT '✨';
ALTER TABLE "Achievement" ADD COLUMN "xpReward" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Achievement" ADD COLUMN "condition" TEXT NOT NULL DEFAULT '';
ALTER TABLE "UserAchievement" ADD COLUMN "pinSlot" INTEGER;

CREATE TABLE "Ban" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'permanent',
    "reason" TEXT,
    "roomId" TEXT,
    "userId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "liftedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ban_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "roomId" TEXT,
    "targetUserId" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subjectKind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "NotificationDeliveryPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "digest" TEXT NOT NULL DEFAULT 'INSTANT',
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietStart" TEXT NOT NULL DEFAULT '22:00',
    "quietEnd" TEXT NOT NULL DEFAULT '08:00',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    CONSTRAINT "NotificationDeliveryPreference_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "NotificationDeliveryQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationDeliveryQueue_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DataExportRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "downloadToken" TEXT NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataExportRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WatchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT,
    "videoUrl" TEXT NOT NULL,
    "title" TEXT,
    "thumbnail" TEXT,
    "source" TEXT,
    "watchCount" INTEGER NOT NULL DEFAULT 1,
    "lastWatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchHistory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WatchSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "roomId" TEXT,
    "watchDuration" INTEGER NOT NULL DEFAULT 0,
    "sessionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RoomHistoryItem" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "source" TEXT NOT NULL,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomHistoryItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FloatReaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FloatReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationDeliveryPreference_userId_key" ON "NotificationDeliveryPreference"("userId");
CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");
CREATE UNIQUE INDEX "DataExportRequest_downloadToken_key" ON "DataExportRequest"("downloadToken");
CREATE UNIQUE INDEX "WatchHistory_userId_videoUrl_key" ON "WatchHistory"("userId", "videoUrl");
CREATE INDEX "Ban_userId_liftedAt_idx" ON "Ban"("userId", "liftedAt");
CREATE INDEX "Ban_roomId_idx" ON "Ban"("roomId");
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "NotificationDeliveryQueue_status_scheduledFor_idx" ON "NotificationDeliveryQueue"("status", "scheduledFor");
CREATE INDEX "DataExportRequest_userId_status_idx" ON "DataExportRequest"("userId", "status");
CREATE INDEX "DataExportRequest_expiresAt_idx" ON "DataExportRequest"("expiresAt");
CREATE INDEX "WatchHistory_userId_lastWatchedAt_idx" ON "WatchHistory"("userId", "lastWatchedAt");
CREATE INDEX "WatchSession_userId_partnerId_idx" ON "WatchSession"("userId", "partnerId");
CREATE INDEX "RoomHistoryItem_roomId_watchedAt_idx" ON "RoomHistoryItem"("roomId", "watchedAt");
CREATE INDEX "ModerationAction_roomId_createdAt_idx" ON "ModerationAction"("roomId", "createdAt");
CREATE INDEX "FloatReaction_roomId_createdAt_idx" ON "FloatReaction"("roomId", "createdAt");

ALTER TABLE "Ban" ADD CONSTRAINT "Ban_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDeliveryPreference" ADD CONSTRAINT "NotificationDeliveryPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDeliveryQueue" ADD CONSTRAINT "NotificationDeliveryQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataExportRequest" ADD CONSTRAINT "DataExportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchHistory" ADD CONSTRAINT "WatchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchSession" ADD CONSTRAINT "WatchSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchSession" ADD CONSTRAINT "WatchSession_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomHistoryItem" ADD CONSTRAINT "RoomHistoryItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FloatReaction" ADD CONSTRAINT "FloatReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
