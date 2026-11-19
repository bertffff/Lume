export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceEnv {
  LIVEKIT_URL?: string | undefined;
  STUN_URLS?: string | undefined;
  TURN_URL?: string | undefined;
  TURN_URLS?: string | undefined;
  TURN_USERNAME?: string | undefined;
  TURN_CREDENTIAL?: string | undefined;
}

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hostOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname || null;
  } catch {
    return null;
  }
}

/**
 * The browser-facing ICE list. TURN credentials come from env; when LiveKit is
 * configured its host also gets a STUN entry so voice and the ICE endpoint agree.
 */
export function iceServersFor(env: IceEnv): IceServer[] {
  const stun = list(env.STUN_URLS);
  if (stun.length === 0) stun.push("stun:stun.l.google.com:19302");
  const liveKitHost = hostOf(env.LIVEKIT_URL);
  if (liveKitHost && !stun.some((url) => url.includes(liveKitHost))) {
    stun.push(`stun:${liveKitHost}:3478`);
  }

  const servers: IceServer[] = stun.map((url) => ({ urls: url }));
  const turn = list(env.TURN_URLS);
  if (turn.length === 0) turn.push(...list(env.TURN_URL));
  if (turn.length > 0) {
    servers.push({
      urls: turn.length === 1 ? (turn[0] ?? "") : turn,
      ...(env.TURN_USERNAME ? { username: env.TURN_USERNAME } : {}),
      ...(env.TURN_CREDENTIAL ? { credential: env.TURN_CREDENTIAL } : {}),
    });
  }
  return servers;
}
