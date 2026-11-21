import { classifyNetworkPreflight, type PreflightNetwork } from "@lume/contracts";
import { apiUrl } from "../api/client.js";

export interface VoicePreflightResult {
  mic: boolean;
  micLevel: number;
  speaker: boolean;
  network: PreflightNetwork;
  devices?: { input: number; output: number };
  checkedAt?: string | null;
}

function audioContext(): typeof AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ?? null;
}

export async function measureMicLevel(): Promise<{ ok: boolean; level: number }> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const track = stream.getAudioTracks()[0];
    if (!track) {
      for (const item of stream.getTracks()) item.stop();
      return { ok: false, level: 0 };
    }
    const Ctor = audioContext();
    if (!Ctor) {
      for (const item of stream.getTracks()) item.stop();
      return { ok: false, level: 0 };
    }
    const context = new Ctor();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let peak = 0;
    const until = performance.now() + 800;
    while (performance.now() < until) {
      await new Promise((resolve) => window.setTimeout(resolve, 60));
      analyser.getByteTimeDomainData(data);
      for (const value of data) peak = Math.max(peak, Math.abs(value - 128));
    }
    await context.close();
    for (const item of stream.getTracks()) item.stop();
    return { ok: true, level: Math.min(100, Math.round((peak / 128) * 100)) };
  } catch {
    return { ok: false, level: 0 };
  }
}

export async function checkSpeaker(): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (!devices.some((device) => device.kind === "audiooutput")) {
      return false;
    }
    const Ctor = audioContext();
    if (!Ctor) return false;
    const context = new Ctor();
    await context.resume().catch(() => undefined);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = 0.02;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    oscillator.stop();
    await context.close();
    return true;
  } catch {
    return false;
  }
}

export function readNetworkScore(): PreflightNetwork {
  const connection = (navigator as unknown as {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
  }).connection;
  return classifyNetworkPreflight(connection ?? {});
}

export async function runVoicePreflight(): Promise<VoicePreflightResult> {
  const [mic, speaker, devices] = await Promise.all([
    measureMicLevel(),
    checkSpeaker(),
    (navigator.mediaDevices?.enumerateDevices() ?? Promise.resolve([] as MediaDeviceInfo[]))
      .then((list) => ({
        input: list.filter((device) => device.kind === "audioinput").length,
        output: list.filter((device) => device.kind === "audiooutput").length,
      }))
      .catch(() => ({ input: 0, output: 0 })),
  ]);
  return {
    mic: mic.ok,
    micLevel: mic.level,
    speaker,
    network: readNetworkScore(),
    devices,
  };
}

export async function saveVoicePreflight(token: string, result: VoicePreflightResult): Promise<VoicePreflightResult> {
  const response = await fetch(`${apiUrl}/voice/preflight`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(result),
  });
  const payload = (await response.json().catch(() => ({}))) as { preflight?: VoicePreflightResult; error?: string };
  if (!response.ok || !payload.preflight) {
    throw new Error(payload.error ?? "preflight_failed");
  }
  return payload.preflight;
}
