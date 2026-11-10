const blockedNames = new Set(["localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback"]);

export function hostnameBlocked(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  if (blockedNames.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  return ipBlocked(host);
}

export function ipBlocked(ip: string): boolean {
  const mapped = ip.toLowerCase().startsWith("::ffff:") ? ip.slice(7) : ip;
  if (mapped.includes(":")) {
    const value = mapped.toLowerCase();
    return value === "::1" || value === "::" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("ff");
  }
  const parts = mapped.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a = 0, b = 0] = parts;
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 255 && b === 255 && parts[2] === 255 && parts[3] === 255) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

/** Resolves the host and rejects the URL when any address is private. */
export async function dnsPinned(
  hostname: string,
  lookup: (host: string) => Promise<readonly string[]>,
): Promise<boolean> {
  if (hostnameBlocked(hostname)) {
    return false;
  }
  const addresses = await lookup(hostname);
  if (addresses.length === 0) {
    return false;
  }
  return addresses.every((address) => !ipBlocked(address));
}

export function urlBlocked(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return true;
  }
  return hostnameBlocked(parsed.hostname);
}
