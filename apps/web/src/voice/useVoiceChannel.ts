import { useEffect, useRef, useState } from "react";
import { api, ClientError } from "../api/client.js";
import { hapticImpact } from "../telegram/adapter.js";
import { readTelegramWebApp } from "../telegram/types.js";
import { useRoomActions } from "../room/live.js";

interface LiveKitHandle {
  disconnect: () => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
  switchMic: (deviceId: string) => Promise<void>;
  muted: () => boolean;
  setDeafened: (deafened: boolean) => Promise<void>;
}

export function useVoiceChannel(roomId: string | undefined) {
  const live = useRoomActions();
  const handle = useRef<LiveKitHandle | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [stub, setStub] = useState(false);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(true);
  const [deafened, setDeafened] = useState(false);
  const [devices, setDevices] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stopped = false;
    void api
      .voiceStatus()
      .then((status) => {
        if (!stopped) {
          setEnabled(status.enabled);
          setStub(Boolean(status.stub));
        }
      })
      .catch(() => {
        if (!stopped) {
          setEnabled(false);
        }
      });
    return () => {
      stopped = true;
    };
  }, []);

  const forceId = live?.voiceForce?.id;
  const selfId = live?.selfId;
  useEffect(() => {
    const command = live?.voiceForce;
    if (!command || command.userId !== selfId || !handle.current) {
      return;
    }
    if (command.action === "disconnect") {
      void handle.current.disconnect();
      setJoined(false);
      setMuted(true);
      live?.leaveVoicePresence();
      return;
    }
    void handle.current.setMuted(true);
    setMuted(true);
    live?.reportVoice(true, false);
  }, [forceId, live, selfId]);

  useEffect(() => {
    return () => {
      void handle.current?.disconnect();
    };
  }, []);

  async function requestMicrophone(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) {
        track.stop();
      }
      return true;
    } catch {
      return false;
    }
  }

  async function join() {
    if (!live || !roomId || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    if (stub) {
      setMuted(false);
      setJoined(true);
      live.joinVoicePresence();
      live.reportVoice(false, false);
      setBusy(false);
      return;
    }
    const allowed = await requestMicrophone();
    if (!allowed) {
      setError("mic_denied");
      setBusy(false);
      return;
    }
    try {
      const creds = await api.voiceToken(live.accessToken, roomId);
      const { Room, RoomEvent } = await import("livekit-client");
      const room = new Room({ adaptiveStream: true, dynacast: true });
      await room.connect(creds.url, creds.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      const inputs = await Room.getLocalDevices("audioinput", true);
      setDevices(inputs.map((device) => ({ deviceId: device.deviceId, label: device.label || device.deviceId })));
      const report = (speaking: boolean) => {
        const nextMuted = !room.localParticipant.isMicrophoneEnabled;
        setMuted(nextMuted);
        live.reportVoice(nextMuted, speaking && !nextMuted);
      };
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        report(speakers.some((speaker) => speaker.identity === live.selfId));
      });
      room.on(RoomEvent.Disconnected, () => {
        setJoined(false);
        live.leaveVoicePresence();
      });
      handle.current = {
        disconnect: async () => {
          await room.disconnect();
        },
        setMuted: async (next) => {
          await room.localParticipant.setMicrophoneEnabled(!next);
        },
        switchMic: async (nextDevice) => {
          await room.switchActiveDevice("audioinput", nextDevice);
        },
        muted: () => !room.localParticipant.isMicrophoneEnabled,
        setDeafened: async (next) => {
          for (const participant of room.remoteParticipants.values()) {
            for (const publication of participant.audioTrackPublications.values()) {
              if (next) {
                publication.track?.detach();
              } else if (publication.track) {
                publication.track.attach();
              }
            }
          }
        },
      };
      setMuted(false);
      setJoined(true);
      live.joinVoicePresence();
      live.reportVoice(false, false);
    } catch (caught) {
      setError(caught instanceof ClientError ? caught.code : "voice_failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDeafen() {
    const next = !deafened;
    if (stub) {
      setDeafened(next);
      hapticImpact(readTelegramWebApp(), "light");
      return;
    }
    await handle.current?.setDeafened(next);
    setDeafened(next);
    hapticImpact(readTelegramWebApp(), "light");
  }

  async function leave() {
    if (stub) {
      setJoined(false);
      setMuted(true);
      live?.leaveVoicePresence();
      return;
    }
    await handle.current?.disconnect();
    handle.current = null;
    setJoined(false);
    setMuted(true);
    setDeafened(false);
    live?.leaveVoicePresence();
  }

  async function toggleMute() {
    if (stub) {
      const next = !muted;
      setMuted(next);
      hapticImpact(readTelegramWebApp(), "light");
      live?.reportVoice(next, false);
      return;
    }
    if (!handle.current) {
      return;
    }
    const next = !muted;
    await handle.current.setMuted(next);
    setMuted(next);
    hapticImpact(readTelegramWebApp(), "light");
    live?.reportVoice(next, false);
  }

  async function pickDevice(nextDevice: string) {
    setDeviceId(nextDevice);
    await handle.current?.switchMic(nextDevice);
  }

  return {
    enabled,
    stub,
    joined,
    muted,
    deafened,
    devices,
    deviceId,
    error,
    busy,
    join,
    leave,
    toggleMute,
    toggleDeafen,
    pickDevice,
  };
}
