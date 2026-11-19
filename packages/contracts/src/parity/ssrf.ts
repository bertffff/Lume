const blockedNames = new Set(["localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback"]);

function bareHost(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[+|\]+$/g, "")
    .replace(/\.+$/, "")
    .split("%")[0] ?? "";
}

export function hostnameBlocked(hostname: string): boolean {
  const host = bareHost(hostname);
  if (blockedNames.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  return ipBlocked(host);
}

function ipv4Blocked(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
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

/** Expands an IPv6 literal (possibly bracketed, compressed, or IPv4-mapped) into eight 16-bit groups. */
function ipv6Groups(raw: string): number[] | null {
  let text = raw;
  const embedded = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (embedded) {
    const octets = (embedded[2] ?? "").split(".").map((part) => Number(part));
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return null;
    }
    const high = ((octets[0] ?? 0) << 8) | (octets[1] ?? 0);
    const low = ((octets[2] ?? 0) << 8) | (octets[3] ?? 0);
    text = `${embedded[1] ?? ""}${high.toString(16)}:${low.toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":").filter((part) => part.length > 0) : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":").filter((part) => part.length > 0) : [];
  if (halves.length === 1 && head.length !== 8) return null;
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  const parts = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (parts.length !== 8) return null;
  const groups: number[] = [];
  for (const part of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
    groups.push(Number.parseInt(part, 16));
  }
  return groups;
}

function ipv6Blocked(ip: string): boolean {
  const groups = ipv6Groups(ip);
  if (!groups) {
    return true;
  }
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups;
  const embeddedV4 = (high: number, low: number) => ipv4Blocked(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
  const zeroPrefix = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  // :: and ::1
  if (zeroPrefix && g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) return true;
  // ::ffff:a.b.c.d (IPv4-mapped)
  if (zeroPrefix && g5 === 0xffff) return embeddedV4(g6, g7);
  // ::ffff:0:a.b.c.d (SIIT)
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0xffff && g5 === 0) return embeddedV4(g6, g7);
  // deprecated IPv4-compatible ::a.b.c.d
  if (zeroPrefix && g5 === 0 && (g6 !== 0 || g7 > 1)) return embeddedV4(g6, g7);
  // link-local fe80::/10, unique-local fc00::/7, multicast ff00::/8
  if ((g0 & 0xffc0) === 0xfe80) return true;
  if ((g0 & 0xfe00) === 0xfc00) return true;
  if ((g0 & 0xff00) === 0xff00) return true;
  // discard-only 100::/64
  if (g0 === 0x100 && g1 === 0 && g2 === 0 && g3 === 0) return true;
  // 6to4 2002::/16 and NAT64 64:ff9b::/96 embed an IPv4 address
  if (g0 === 0x2002) return embeddedV4(g1, g2);
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return true;
  return false;
}

export function ipBlocked(ip: string): boolean {
  const mapped = bareHost(ip);
  if (mapped.includes(":")) {
    return ipv6Blocked(mapped);
  }
  return ipv4Blocked(mapped);
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
