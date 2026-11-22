/**
 * Single source of truth for local E2E service endpoints.
 *
 * Playwright's config, its web servers, and the browser-facing build all derive
 * their origins from here. A port override therefore cannot drift between the
 * runner and the assertions in migrated specs.
 *
 * All bindings are loopback-only by design: the API, realtime, preview and
 * metadata fixture servers bind 127.0.0.1, and their derived origins use the
 * same host. Override ports with E2E_API_PORT / E2E_REALTIME_PORT /
 * E2E_WEB_PORT / E2E_MOCK_PORT. The web app is built (not previewed) with
 * matching VITE_API_URL / VITE_REALTIME_URL — see docs/releases/v1/e2e-isolation.md
 * and turbo.json build env hashing.
 */

const localHost = "127.0.0.1";

function readPort(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} must be a valid TCP port (1-65535), got "${raw}"`);
  }
  return value;
}

export const ports = {
  api: readPort("E2E_API_PORT", 3001),
  realtime: readPort("E2E_REALTIME_PORT", 3002),
  web: readPort("E2E_WEB_PORT", 5173),
  mock: readPort("E2E_MOCK_PORT", 3099),
} as const;

export function origin(port: number): string {
  return `http://${localHost}:${port}`;
}

export const apiUrl = origin(ports.api);
export const realtimeUrl = origin(ports.realtime);
export const webUrl = origin(ports.web);
export const mockUrl = origin(ports.mock);
export const oembedBaseUrl = `${mockUrl}/oembed`;
