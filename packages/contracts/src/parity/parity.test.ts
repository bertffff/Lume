import { describe, expect, it } from "vitest";
import { levelFromXp, earnedAchievementKeys, xpForKeys } from "./achievements.js";
import { passwordIssue,
  registerAvailability,
  magicTokenFromSearch,
  unlinkAllowed,
  linkedLabel,
  scheduledDeletion,
  clampResumePosition,
  matchesBrowse,
  reportIssue,
  refreshKeepsPlayback,
  recoveryActions,
  lastIncidents,
  emojiCategories,
  withoutBlocked,
  historyLabel, allowHit, tempMuteExpiry, slowModeAllows, resumeCard } from "./account.js";
import { clockSample, median, pushWindow, smoothRtt } from "./clock.js";
import { planDrift } from "./drift.js";
import { hostLeavePauses, nextHost, reclaimHost } from "./host.js";
import { rewriteHlsManifest } from "./manifest.js";
import { allowsAction, allowsModeration, defaultViewerPermissions } from "./permissions.js";
import { buildDigest, inQuietHours, nextDigestAt } from "./quiet.js";
import { decideFriendRequest, canToggleReaction, extractTimecodeSeconds, mentionsUser } from "./social.js";
import { detectSource, planPlayback } from "./sources.js";
import { hostnameBlocked, ipBlocked, urlBlocked, dnsPinned } from "./ssrf.js";
import {
  autoQuality,
  consumeMagic,
  duplicateQueue,
  dayScore,
  gestureDelta,
  imageKind,
  innertubeFromFixture,
  rutubeFromFixture,
  heartbeatLag,
  isFavourite,
  shouldRecordWatch,
  hlsProxyUrl,
  shouldHoldForReady,
  twitchFromFixture,
  typingLine,
  vkFromFixture,
  moveQueueItem,
  notificationChannels,
  notificationKinds,
  pageSlice,
  playbackRates,
  playerShortcut,
  rotateRefresh,
  runExtractorChain,
  shouldRefreshLink,
  slowRemainingMs,
  yearHeatmap,
} from "./flow.js";
import { castSkipVote, withdrawSkipVote } from "./vote.js";

describe("parity rules", () => {
  it("keeps ban and host transfer with the host, and lets a mod kick", () => {
    expect(allowsModeration("mod", "kick")).toBe(true);
    expect(allowsModeration("mod", "ban")).toBe(false);
    expect(allowsModeration("mod", "makeHost")).toBe(false);
    expect(allowsAction("viewer", "playback", defaultViewerPermissions)).toBe(false);
    expect(allowsAction("viewer", "queueAdd", defaultViewerPermissions)).toBe(true);
    expect(allowsAction("host", "settings", defaultViewerPermissions)).toBe(true);
  });

  it("picks a moderator before the oldest viewer", () => {
    expect(hostLeavePauses("host")).toBe(true);
    expect(hostLeavePauses("viewer")).toBe(false);
    const next = nextHost(
      [
        { userId: "host", role: "host", joinedAtMs: 1 },
        { userId: "old", role: "viewer", joinedAtMs: 2 },
        { userId: "mod", role: "mod", joinedAtMs: 3 },
      ],
      "host",
    );
    expect(next).toBe("mod");
    expect(reclaimHost({ permanentHostId: "host", joiningUserId: "host", currentHostId: "mod" })).toBe(true);
  });

  it("skips immediately for the host and at half the room otherwise", () => {
    const first = castSkipVote({ memberCount: 4, votes: [], voterId: "a", isHost: false });
    expect(first.skipped).toBe(false);
    expect(first.needed).toBe(2);
    const host = castSkipVote({ memberCount: 4, votes: [], voterId: "h", isHost: true });
    expect(host.skipped).toBe(true);
    expect(withdrawSkipVote(["a", "b"], "a")).toEqual(["b"]);
  });

  it("uses the median clock offset and a soft or hard drift plan", () => {
    const sample = clockSample(1_000, 1_100, 1_180);
    expect(sample.rttMs).toBe(180);
    expect(sample.offsetMs).toBe(10);
    expect(median([3, 1, 2])).toBe(2);
    expect(pushWindow([1], 2, 2)).toEqual([1, 2]);
    expect(smoothRtt(10, 20)).toBe(11);
    const soft = planDrift({
      localMs: 0,
      expectedMs: 400,
      embed: false,
      loadedAgoMs: 20_000,
      bufferedToMs: 10_000,
      recentSeeks: [],
      nowMs: 0,
      buffering: false,
      bufferEndedAtMs: null,
    });
    expect(soft.status).toBe("soft-correcting");
    expect(soft.playbackRate).toBeGreaterThan(1);
    const looping = planDrift({
      localMs: 0,
      expectedMs: 4_000,
      embed: false,
      loadedAgoMs: 20_000,
      bufferedToMs: 20_000,
      recentSeeks: [
        { atMs: 1_000, targetMs: 4_000 },
        { atMs: 2_000, targetMs: 4_100 },
      ],
      nowMs: 3_000,
      buffering: false,
      bufferEndedAtMs: null,
    });
    expect(looping.status).toBe("waiting");
  });

  it("awards the ten party achievements and a level from xp", () => {
    expect(levelFromXp(500)).toBe(2);
    const keys = earnedAchievementKeys({
      totalParties: 10,
      totalWatchTime: 18_000,
      totalMessages: 100,
      roomsCreated: 10,
      totalReactions: 50,
      hourInZone: 1,
    });
    expect(keys).toContain("night_watch");
    expect(keys).toContain("host_master");
    expect(keys).not.toContain("early_bird");
    expect(xpForKeys(["first_party"])).toBe(50);
  });

  it("blocks a friend request against a block and caps reactions at three", () => {
    expect(decideFriendRequest("a", "a", [])).toEqual({ action: "reject", reason: "self" });
    expect(
      decideFriendRequest("a", "b", [{ id: "1", requesterId: "b", addresseeId: "a", status: "pending" }]),
    ).toEqual({ action: "accept", id: "1" });
    expect(canToggleReaction(["👍", "🔥", "😂"], "❤️")).toBe(false);
    expect(canToggleReaction(["👍", "🔥", "😂"], "🔥")).toBe(true);
    expect(extractTimecodeSeconds("смотри ?t=90")).toBe(90);
    expect(extractTimecodeSeconds("момент 1:02:03")).toBe(3723);
    expect(mentionsUser("привет @Аня", null, "Аня")).toBe(true);
  });

  it("treats 22:00–08:00 as quiet hours and refuses private URLs", () => {
    const night = new Date("2026-11-04T23:30:00.000Z");
    expect(inQuietHours({ now: night, start: "22:00", end: "08:00", timeZone: "UTC", enabled: true })).toBe(true);
    expect(inQuietHours({ now: new Date("2026-11-04T12:00:00.000Z"), start: "22:00", end: "08:00", timeZone: "UTC", enabled: true })).toBe(false);
    const later = nextDigestAt({ now: night, digest: "HOURLY", quiet: false });
    expect(later.getUTCMinutes()).toBe(0);
    expect(buildDigest([{ title: "A", body: "b", kind: "SYSTEM" }]).title).toBe("A");
    expect(buildDigest([
      { title: "A", body: "b", kind: "SYSTEM" },
      { title: "C", body: "d", kind: "SYSTEM" },
    ]).title).toBe("TeleRave digest: 2 updates");
    expect(ipBlocked("127.0.0.1")).toBe(true);
    expect(ipBlocked("8.8.8.8")).toBe(false);
    expect(hostnameBlocked("app.local")).toBe(true);
    expect(urlBlocked("http://169.254.1.1/x")).toBe(true);
    expect(urlBlocked("file:///etc/passwd")).toBe(true);
  });

  it("rewrites HLS lines and gates premium-only sources", () => {
    const rewritten = rewriteHlsManifest("#EXTM3U\nseg.ts\n", "https://cdn.example/a.m3u8", "rutube", "/api/video/hls-proxy");
    expect(rewritten).toContain("/api/video/hls-proxy?url=");
    expect(rewritten).toContain("#EXT-X-ENDLIST");
    expect(rewritten).toContain("#EXT-X-PLAYLIST-TYPE:VOD");
    expect(detectSource("https://youtu.be/abc")?.id).toBe("youtube");
    expect(detectSource("https://vk.com/video-1_2")?.id).toBe("vk");
    expect(detectSource("https://rutube.ru/video/abc/")?.id).toBe("rutube");
    expect(planPlayback({ url: "https://www.tiktok.com/@a/video/1", premium: false })).toEqual({
      type: "error",
      code: "premium_required",
    });
    expect(planPlayback({ url: "https://youtu.be/abc", premium: true }).type).toBe("extract");
    expect(planPlayback({ url: "https://cdn.example/a.m3u8", premium: false })).toEqual({ type: "direct", proxy: "hls" });
  });

  it("checks password shape, search rate, mute length, and slow mode", () => {
    expect(passwordIssue("short")).toBe("short");
    expect(passwordIssue("NoDigitHere")).toBe("shape");
    expect(passwordIssue("GoodPass1")).toBe(null);
    expect(registerAvailability("production", false)).toBe("redis_unconfigured");
    expect(registerAvailability("development", false)).toBe("ok");
    expect(magicTokenFromSearch("?magic=abcdef12")).toBe("abcdef12");
    expect(magicTokenFromSearch("?magic=short")).toBeNull();
    expect(unlinkAllowed(true)).toBe(true);
    expect(unlinkAllowed(false)).toBe(false);
    expect(linkedLabel({ email: true, telegram: true })).toBe("почта · Telegram");
    expect(linkedLabel({ email: false, telegram: false })).toBe("нет");
    expect(scheduledDeletion(0)).toBe(30 * 24 * 60 * 60 * 1000);
    expect(clampResumePosition(-10, 1000)).toBe(0);
    expect(clampResumePosition(5000, 1000)).toBe(1000);
    expect(matchesBrowse("Ночной кинозал", "7KQ2M", "кино")).toBe(true);
    expect(matchesBrowse("Ночной кинозал", "7KQ2M", "zzz")).toBe(false);
    expect(reportIssue("спам", "user-1")).toBeNull();
    expect(reportIssue("", "user-1")).toBe("reason");
    expect(reportIssue("спам", "")).toBe("target");
    expect(refreshKeepsPlayback(1200, true)).toEqual({ positionMs: 1200, status: "playing" });
    expect(refreshKeepsPlayback(-5, false).positionMs).toBe(0);
    expect(recoveryActions).toEqual(["retry", "open", "replace"]);
    expect(lastIncidents([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(Object.values(emojiCategories).flat().length).toBeGreaterThan(3);
    expect(withoutBlocked([{ id: "a" }, { id: "b" }], "a")).toEqual([{ id: "b" }]);
    expect(historyLabel(3)).toBe("история 3");
    expect(historyLabel(0)).toBe("");
    const first = allowHit({ hits: [] }, 0, 2, 1_000);
    const second = allowHit(first.bucket, 10, 2, 1_000);
    const third = allowHit(second.bucket, 20, 2, 1_000);
    expect(third.ok).toBe(false);
    expect(tempMuteExpiry(0, 10)).toBe(null);
    expect(tempMuteExpiry(0, 30)).toBe(30_000);
    expect(slowModeAllows(0, 1_000, 5, false)).toBe(false);
    expect(slowModeAllows(0, 1_000, 5, true)).toBe(true);
    expect(resumeCard({ title: "Зал", description: "", isPublic: false, maxMembers: 12, videoUrl: "https://youtu.be/a", positionMs: 1000, queue: [], historyCount: 2 })?.historyCount).toBe(2);
  });

  it("covers queue moves, link refresh, extractors, images, and sessions", async () => {
    expect(slowRemainingMs(0, 2_000, 5, false)).toBe(3_000);
    expect(slowRemainingMs(0, 2_000, 5, true)).toBe(0);
    expect(moveQueueItem(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(shouldRefreshLink(1_000, 800, 300)).toBe(true);
    expect(shouldRefreshLink(10_000, 0, 300)).toBe(false);
    const chain = runExtractorChain([
      () => innertubeFromFixture({ playability: "UNPLAYABLE" }),
      () => innertubeFromFixture({ playability: "OK", url: "https://cdn.example/a.mp4", title: "Ролик", expiresAtMs: 50 }),
    ]);
    expect(chain).toMatchObject({ title: "Ролик" });
    expect(runExtractorChain([() => null])).toEqual({ error: "unconfigured" });
    expect(imageKind(Uint8Array.from([0xff, 0xd8, 0xff, 0]))).toBe("jpeg");
    expect(imageKind(Uint8Array.from([1, 2, 3]))).toBeNull();
    expect(dayScore(10, 2, 4)).toBe(10 + 60 + 20);
    const tokens = new Map([["old", { userId: "u", expiresAt: 100 }]]);
    expect(rotateRefresh(tokens, "old", "new", 50, 100)).toBe("u");
    expect(tokens.has("old")).toBe(false);
    expect(tokens.get("new")?.expiresAt).toBe(150);
    const magic = new Map([["tok", { email: "a@b.c", expiresAt: 100, used: false }]]);
    expect(consumeMagic(magic, "tok", 50)).toBe("a@b.c");
    expect(consumeMagic(magic, "tok", 50)).toBeNull();
    await expect(dnsPinned("cdn.example", async () => ["8.8.8.8"])).resolves.toBe(true);
    await expect(dnsPinned("cdn.example", async () => ["127.0.0.1"])).resolves.toBe(false);
    expect(yearHeatmap(new Date("2026-01-10T00:00:00.000Z"), { "2026-01-10": 4 })).toHaveLength(365);
    expect(yearHeatmap(new Date("2026-01-10T00:00:00.000Z"), { "2026-01-10": 4 }).at(-1)?.score).toBe(4);
    expect(pageSlice(["a", "b", "c"], 1, 2).items).toEqual(["c"]);
    expect(gestureDelta("right", 2)).toBe(10);
    expect(gestureDelta("center", 1)).toBe("toggle");
    expect(autoQuality(0.2)).toBe("low");
    expect(playerShortcut("j", true)).toBe("back");
    expect(playerShortcut("j", false)).toBeNull();
    expect(notificationChannels.length * notificationKinds.length).toBe(24);
    expect(playbackRates).toContain(1);
    expect(duplicateQueue(["https://youtu.be/a"], "https://youtu.be/a")).toBe(true);
    expect(vkFromFixture({ hls: "https://vk.cdn/a.m3u8", title: "VK" })?.title).toBe("VK");
    expect(rutubeFromFixture({ m3u8: "https://rutube/a.m3u8" })?.url).toContain("rutube");
    expect(twitchFromFixture(null)).toBeNull();
    expect(heartbeatLag(2_000, 1_000)).toBe(1_000);
    expect(shouldRecordWatch(0, 31_000)).toBe(true);
    expect(isFavourite(2)).toBe(true);
    expect(shouldHoldForReady(true, 1)).toBe(true);
    expect(hlsProxyUrl("http://api", "https://cdn/a.m3u8")).toContain("hls-proxy");
    expect(typingLine(["Аня", "Боря"])).toBe("Аня и ещё 1 печатают…");
  });
});
