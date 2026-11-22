import { defaultRoomLayout, type QueueItem } from "@lume/contracts";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomProvider, type RoomActions } from "../room/live.js";
import { createPlayerAdapter } from "../player/create.js";
import { RoomStage } from "./RoomStage.js";
import { applyAppearance } from "./theme.js";

vi.mock("../player/create.js", () => ({ createPlayerAdapter: vi.fn() }));
vi.mock("../voice/useVoiceChannel.js", () => ({ useVoiceChannel: () => ({ joined: false, enabled: true }) }));

const noop = () => undefined;
const media: QueueItem = {
  id: "media", roomId: "room", url: "https://example.test/video.mp4", provider: "direct", externalId: "media",
  title: "Live media", thumbnailUrl: null, durationMs: null, position: 0, addedById: "host", played: false,
};

function actions(role: "host" | "viewer", nowPlaying: QueueItem | null, queue: QueueItem[] = []): RoomActions {
  return {
    state: {
      room: { id: "room", title: "Live room", code: "7kq2mx", hostId: "host", status: "open", isPublic: false, memberCount: 2, createdAt: "2025-01-01" , nowPlaying },
      self: { role, muted: false },
      members: [
        { userId: "host", role: "host", displayName: "Host", muted: false, joinedAtMs: 1 },
        { userId: "viewer", role: "viewer", displayName: "Guest", muted: false, joinedAtMs: 2 },
      ],
      playback: { roomId: "room", status: "paused", positionMs: 0, anchorPositionMs: 0, anchorServerTimeMs: 0, serverTimeMs: 0, version: 1, updatedBy: "host" },
      viewers: [], messages: [], voice: [], queue,
    },
    positionMs: 0, offsetMs: 0, canControl: role === "host", selfId: role, accessToken: "test-token", voiceForce: null,
    clockOffset: 0, skip: { votes: 0, needed: 1 }, typingName: null, typingNames: [], heartbeatAt: null, floats: [],
    sendChat: vi.fn(), kick: vi.fn(), mute: vi.fn(), promote: vi.fn(), addQueue: vi.fn(), playNext: vi.fn(),
    sendImage: noop, react: noop, reloadHistory: noop, removeQueueItem: noop, moveQueueItem: noop, playQueueItem: noop, setPlayback: noop, reportViewer: noop, joinVoicePresence: noop,
    leaveVoicePresence: noop, reportVoice: noop, muteVoices: noop, disconnectVoice: noop, heartbeat: noop, voteSkip: noop,
    sendTyping: noop, sendFloat: noop,
  };
}

function stage(value: RoomActions, videoAspect = defaultRoomLayout.videoAspect) {
  return <RoomProvider value={value}><RoomStage layout={{ ...defaultRoomLayout, videoAspect }} synced onLayout={noop} onLeave={noop} /></RoomProvider>;
}

describe("live room composition", () => {
  beforeEach(() => {
    applyAppearance("cinema", "dark");
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it("uses one add form, caps the preview, and preserves the chat draft through keyboard navigation", () => {
    const queue = [1, 2, 3].map((n) => ({ ...media, id: `item-${n}`, title: `Next ${n}` }));
    const value = actions("viewer", null, queue);
    render(stage(value));
    expect(screen.getAllByTestId("room-header")).toHaveLength(1);
    expect(screen.getAllByTestId("room-playbar")).toHaveLength(1);
    expect(screen.getAllByTestId("queue-preview-item")).toHaveLength(2);
    expect(screen.getByTestId("room-playbar")).not.toHaveTextContent(/00:00|1080p/);
    expect(screen.queryByTestId("room-settings-open")).not.toBeInTheDocument();
    const draft = screen.getByTestId("chat-input");
    fireEvent.change(draft, { target: { value: "Message in progress" } });
    fireEvent.click(screen.getByTestId("queue-open-add"));
    expect(screen.getByTestId("queue-input")).toHaveFocus();
    expect(screen.getAllByTestId("queue-input")).toHaveLength(1);
    const queueTab = screen.getByTestId("session-dock-queue");
    queueTab.focus();
    fireEvent.keyDown(queueTab, { key: "ArrowRight" });
    expect(screen.getByTestId("session-dock-chat")).toHaveFocus();
    expect(draft).toBeVisible();
    expect(draft).toHaveValue("Message in progress");
  });

  it("limits contextual moderation to eligible non-owner members", () => {
    const viewer = actions("viewer", null);
    const { rerender } = render(stage(viewer));
    fireEvent.click(screen.getByTestId("session-dock-people"));
    expect(screen.queryByTestId("member-kick-host")).not.toBeInTheDocument();
    expect(screen.queryByTestId("member-kick-viewer")).not.toBeInTheDocument();
    const host = actions("host", null);
    rerender(stage(host));
    const people = screen.getByTestId("rail-people");
    const contextual = within(people).getByTestId("member-mute-viewer");
    fireEvent.click(contextual.closest("details")!.querySelector("summary")!);
    fireEvent.click(contextual);
    expect(host.mute).toHaveBeenCalledExactlyOnceWith("viewer", true);
    expect(within(people).queryByTestId("member-mute-host")).not.toBeInTheDocument();
  });

  it("keeps the player mount and adapter across dock, style, mode, size and metadata changes, but reloads for a new URL", async () => {
    const destroy = vi.fn();
    vi.mocked(createPlayerAdapter).mockResolvedValue({
      play: vi.fn().mockResolvedValue(undefined), pause: vi.fn().mockResolvedValue(undefined), seek: vi.fn().mockResolvedValue(undefined),
      destroy, onState: () => noop, getCurrentTime: () => 0, getDuration: () => null, getBuffered: () => null,
      provider: "direct", limited: false,
    });
    const value = actions("host", media);
    const view = render(stage(value));
    const mount = screen.getByTestId("player-mount");
    await waitFor(() => expect(createPlayerAdapter).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("mobile-sheet-toggle"));
    act(() => applyAppearance("gruvbox", "light"));
    expect(screen.getByTestId("room-live")).toHaveAttribute("data-room-style", "gruvbox");
    view.rerender(stage(actions("host", { ...media, title: "Fetched title" }), 9 / 16));
    expect(screen.getByTestId("player-mount")).toBe(mount);
    expect(createPlayerAdapter).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();

    const url = "https://example.test/refreshed.mp4";
    view.rerender(stage(actions("host", { ...media, url })));
    await waitFor(() => expect(createPlayerAdapter).toHaveBeenCalledTimes(2));
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("player-mount")).toBe(mount);
    expect(createPlayerAdapter).toHaveBeenLastCalledWith(expect.objectContaining({ url }), mount, window.location.hostname);
  });
});
