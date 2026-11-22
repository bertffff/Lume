import { expect, test, type Page } from "@playwright/test";
import { apiUrl } from "./helpers/config";

test.describe.configure({ mode: "serial" });

/** Mirrors packages/contracts/src/room-catalog.ts and room.ts. */
interface CatalogRoom {
  id: string;
  code: string;
  title: string;
  hostId: string;
  status: string;
  isPublic: boolean;
  createdAt: string;
  category: "film" | "music" | "vlog" | "other";
  memberCount: number;
  isFull: boolean;
  mediaPreview: { provider: string; title: string; thumbnailUrl: string | null } | null;
}

interface CatalogPage {
  rooms: CatalogRoom[];
  nextCursor: string | null;
}

const filters = ["film", "music", "vlog"] as const;
type Filter = (typeof filters)[number];
const filterLabels: Record<Filter, string> = { film: "Кино", music: "Музыка", vlog: "Влоги" };

async function sessionToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("lume.session");
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken ?? "" : "";
  });
}

/** GET /rooms/catalog?filter=...&cursor=... with the current request contract. */
async function readCatalog(page: Page, token: string, filter: string, cursor?: string): Promise<CatalogPage> {
  const url = new URL("/rooms/catalog", apiUrl);
  url.searchParams.set("filter", filter);
  if (cursor) url.searchParams.set("cursor", cursor);
  const response = await page.request.get(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(response.status(), `${url} status`).toBe(200);
  const body = (await response.json()) as CatalogPage;
  expect(Array.isArray(body.rooms), `${url} rooms`).toBe(true);
  expect(body.nextCursor === null || typeof body.nextCursor === "string", `${url} nextCursor`).toBe(true);
  for (const room of body.rooms) {
    expect(typeof room.id).toBe("string");
    expect(typeof room.code).toBe("string");
    expect(typeof room.title).toBe("string");
    expect(typeof room.memberCount).toBe("number");
    expect(typeof room.isFull).toBe("boolean");
    expect(room.mediaPreview === null || typeof room.mediaPreview?.provider === "string").toBe(true);
  }
  return body;
}

/** Follow the opaque cursor so UI rows can be checked against every real page. */
async function catalogTitles(page: Page, token: string, filter: string): Promise<Set<string>> {
  const titles = new Set<string>();
  let cursor: string | undefined;
  for (let pageNumber = 0; pageNumber < 5; pageNumber += 1) {
    const result = await readCatalog(page, token, filter, cursor);
    for (const room of result.rooms) titles.add(room.title);
    if (result.nextCursor === null) break;
    cursor = result.nextCursor;
  }
  return titles;
}

async function signedIn(page: Page, name: string): Promise<string> {
  await page.goto("/");
  await page.getByTestId("lobby-name").fill(name);
  await page.getByTestId("lobby-sign-in").click();
  await expect(page.getByTestId("home-create-open")).toBeVisible({ timeout: 20_000 });
  const token = await sessionToken(page);
  expect(token).toBeTruthy();
  return token;
}

/** POST /rooms with the exact current body contract; the creator is the active member. */
async function seedRoom(page: Page, token: string, title: string, category: Filter): Promise<void> {
  const created = await page.request.post(`${apiUrl}/rooms`, {
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    data: { title, isPublic: true, categorySelection: category },
  });
  expect(created.status(), `seed ${title}`).toBe(200);
  const body = (await created.json()) as { room?: { id?: string } };
  expect(typeof body.room?.id, `seed ${title} id`).toBe("string");
}

test("the vertical catalog lists real seeded rooms and filters them by category", async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  const token = await signedIn(page, `Каталог ${stamp}`);

  // Keep the global-counter coverage: the rows are real rooms with live hosts.
  const stats = page.getByTestId("global-stats");
  await expect(stats).toBeVisible();
  await expect(stats).toHaveAttribute("data-ready", "true");
  const beforeActive = Number(await page.getByTestId("stat-active-rooms").getAttribute("data-value"));
  const beforeOnline = Number(await page.getByTestId("stat-users-online").getAttribute("data-value"));
  expect(Number.isFinite(beforeActive)).toBe(true);
  expect(Number.isFinite(beforeOnline)).toBe(true);
  expect(beforeOnline).toBeGreaterThanOrEqual(0);

  const seeded: Record<Filter, string[]> = { film: [], music: [], vlog: [] };
  for (const filter of filters) {
    for (let index = 0; index < 2; index += 1) {
      const title = `Каталог ${stamp}-${filter}-${index}`;
      await seedRoom(page, token, title, filter);
      seeded[filter].push(title);
    }
  }

  // Verify the response contract and that each filter returns only its own real rows.
  for (const filter of filters) {
    const result = await readCatalog(page, token, filter);
    const titles = result.rooms.map((room) => room.title);
    for (const room of result.rooms) expect(room.category).toBe(filter);
    for (const title of seeded[filter]) expect(titles).toContain(title);
    for (const other of filters.filter((candidate) => candidate !== filter)) {
      for (const title of seeded[other]) expect(titles).not.toContain(title);
    }
  }

  await page.reload();
  await expect(stats).toHaveAttribute("data-ready", "true");
  await expect.poll(async () => Number(await page.getByTestId("stat-active-rooms").getAttribute("data-value")))
    .toBeGreaterThanOrEqual(beforeActive + filters.length * 2);

  // The vertical feed shows the same rows: filtering works and nothing is fabricated.
  const feed = page.getByTestId("room-feed");
  await expect(feed).toBeVisible();
  const list = feed.getByRole("list", { name: "Комнаты" });
  await expect(list).toBeVisible();
  for (const filter of filters) {
    await feed.getByRole("button", { name: filterLabels[filter], exact: true }).click();
    await expect(list).toBeVisible();
    for (const title of seeded[filter]) {
      await expect(feed.getByRole("heading", { name: title, exact: true })).toBeVisible({ timeout: 20_000 });
    }
    const titles = await feed.getByTestId("room-feed-card").locator("h3").allInnerTexts();
    expect(titles.length).toBeGreaterThan(0);
    for (const other of filters.filter((candidate) => candidate !== filter)) {
      for (const title of seeded[other]) expect(titles).not.toContain(title);
    }
    const realTitles = await catalogTitles(page, token, filter);
    expect(titles.filter((title) => !realTitles.has(title))).toEqual([]);
  }
});

test("the vertical catalog paginates real rows with an opaque cursor", async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  const token = await signedIn(page, `Страницы ${stamp}`);

  // More than one 30-row page, so the cursor and the load-more control are real.
  const seeded: string[] = [];
  for (let index = 0; index < 32; index += 1) {
    const title = `Страница ${stamp}-${index}`;
    await seedRoom(page, token, title, "vlog");
    seeded.push(title);
  }

  const first = await readCatalog(page, token, "all");
  expect(first.rooms).toHaveLength(30);
  expect(typeof first.nextCursor).toBe("string");
  expect((first.nextCursor ?? "").length).toBeGreaterThan(0);
  const second = await readCatalog(page, token, "all", first.nextCursor ?? undefined);
  expect(second.rooms.length).toBeGreaterThan(0);
  const ids = [...first.rooms, ...second.rooms].map((room) => room.id);
  expect(new Set(ids).size).toBe(ids.length);
  const apiTitles = [...first.rooms, ...second.rooms].map((room) => room.title);
  expect(seeded.some((title) => apiTitles.includes(title))).toBe(true);

  await page.reload();
  const feed = page.getByTestId("room-feed");
  await expect(feed).toBeVisible();
  const loadMore = feed.getByRole("button", { name: "Показать ещё" });
  await expect(loadMore).toBeVisible({ timeout: 20_000 });
  await expect(loadMore).toBeEnabled();
  const before = await feed.getByTestId("room-feed-card").count();
  await loadMore.click();
  await expect.poll(async () => feed.getByTestId("room-feed-card").count(), { timeout: 20_000 }).toBeGreaterThan(before);
  const titles = await feed.getByTestId("room-feed-card").locator("h3").allInnerTexts();
  const visibleIds = await feed.locator("[data-room-id]").evaluateAll((cards) => cards.map((card) => card.getAttribute("data-room-id")));
  expect(new Set(visibleIds).size).toBe(visibleIds.length);
  const realTitles = await catalogTitles(page, token, "all");
  expect(titles.filter((title) => !realTitles.has(title))).toEqual([]);
});
