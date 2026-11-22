import { randomInt } from "node:crypto";
import { readdirSync } from "node:fs";
import { createPrismaClient } from "@lume/db";
import { defaultRoomLayout, partyAchievements, ROOM_CODE_ALPHABET } from "@lume/contracts";

/**
 * Realistic data for visual review. Never touches the developer database:
 * the target must be a loopback cluster on a non-default port whose database
 * name contains "design" or "e2e". Validation runs before any connection.
 *
 *   DESIGN_DATABASE_URL=postgresql://…@127.0.0.1:55434/lume_design?schema=public \
 *   POSTER_DIR=/tmp/opencode/design/posters POSTER_BASE=http://127.0.0.1:33199 \
 *   pnpm --filter @lume/api exec tsx scripts/dev-seed-design.ts --profile=full [--bulk=36]
 */
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.replace(/^--/, "").split("=");
  return [key, value ?? "true"] as const;
}));
const profile = args.get("profile") ?? "full";
if (profile !== "full" && profile !== "empty") throw new Error("--profile must be full or empty");
const bulk = Number(args.get("bulk") ?? 0);

function validateTarget(raw: string | undefined): string {
  if (!raw) throw new Error("DESIGN_DATABASE_URL is required (no default on purpose)");
  const url = new URL(raw);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) throw new Error(`Refusing non-loopback host ${url.hostname}`);
  if (url.port === "" || url.port === "5432") throw new Error("Refusing the default Postgres port");
  if (!/^[a-z0-9_]+$/.test(name) || !/(design|e2e)/.test(name)) throw new Error(`Refusing database "${name}": name must contain design or e2e`);
  return raw;
}
process.env.DATABASE_URL = validateTarget(process.env.DESIGN_DATABASE_URL);

const posterBase = process.env.POSTER_BASE ?? "http://127.0.0.1:33199";
const posterDir = process.env.POSTER_DIR ?? "/tmp/opencode/design/posters";
const posters = Object.fromEntries(readdirSync(posterDir).map((file) => [file.split("-")[0], `${posterBase}/${file}`]));
const poster = (key: string) => posters[key] ?? null;

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;
const now = Date.now();
const ago = (ms: number) => new Date(now - ms);

const newCode = () => Array.from({ length: 6 }, () => ROOM_CODE_ALPHABET.charAt(randomInt(ROOM_CODE_ALPHABET.length))).join("");

function devKey(displayName: string) {
  return displayName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 32);
}

const prisma = createPrismaClient();

async function user(displayName: string, extra: Record<string, unknown> = {}) {
  const username = `dev:${devKey(displayName)}`;
  return prisma.user.upsert({
    where: { username },
    create: { username, displayName, locale: "ru", onboardingComplete: true, ...extra },
    update: { displayName, ...extra },
  });
}

async function reset() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "Achievement" RESTART IDENTITY CASCADE');
}

const people = {
  albert: "Альберт Вопилов",
  liza: "Лиза Морозова",
  artem: "Артём Теплов",
  sonya: "Соня Нечаева",
  dasha: "Даша Лисицына",
  mark: "Марк Орлов",
  nik: "Ник Рябов",
  igor: "Игорь Седых",
  vera: "Вера Князева",
  pasha: "Паша Громов",
  katya: "Катя Белова",
  max: "Макс Фролов",
} as const;

type CategoryId = "film" | "music" | "vlog" | "other";
interface RoomSeed {
  title: string;
  host: keyof typeof people;
  members: Array<keyof typeof people>;
  category: CategoryId;
  media: { title: string; poster: string; provider: string; id: string; durationMin: number };
  startedAgoMin: number;
  maxMembers?: number;
  description?: string;
}

const rooms: RoomSeed[] = [
  { title: "Ночной кинозал", host: "liza", members: ["artem", "mark", "dasha", "vera"], category: "film", startedAgoMin: 8, description: "Субботний сеанс, начинаем в 22:00", media: { title: "Пустая дорога — режиссёрская версия", poster: "p1", provider: "youtube", id: "road0001", durationMin: 123 } },
  { title: "Пятничный звук", host: "sonya", members: ["pasha", "katya", "igor", "max", "vera", "nik"], category: "music", startedAgoMin: 19, media: { title: "Концерт на крыше — live", poster: "p4", provider: "vk", id: "roof0002", durationMin: 72 } },
  { title: "Нуар по средам", host: "nik", members: ["max", "katya"], category: "film", startedAgoMin: 31, media: { title: "Город после дождя", poster: "p2", provider: "youtube", id: "rain0003", durationMin: 108 } },
  { title: "Документалки", host: "dasha", members: ["pasha"], category: "other", startedAgoMin: 44, media: { title: "Лес, который помнит", poster: "p3", provider: "rutube", id: "wood0004", durationMin: 52 } },
  { title: "Лампа и винил", host: "katya", members: ["vera", "igor", "max"], category: "music", startedAgoMin: 63, media: { title: "Ночной плейлист, часть 3", poster: "p5", provider: "youtube", id: "vinyl005", durationMin: 58 } },
  { title: "Хребты и тропы", host: "pasha", members: ["vera"], category: "vlog", startedAgoMin: 90, media: { title: "Три дня на хребте", poster: "p6", provider: "youtube", id: "ridge006", durationMin: 34 } },
  { title: "Станция «Горизонт»", host: "max", members: ["igor", "katya", "pasha", "vera"], category: "film", startedAgoMin: 120, maxMembers: 5, media: { title: "Холодный сектор", poster: "p7", provider: "youtube", id: "cold0007", durationMin: 96 } },
  { title: "Ночной рынок", host: "vera", members: ["katya", "max", "igor", "pasha", "dasha", "nik", "sonya"], category: "vlog", startedAgoMin: 160, media: { title: "Уличная еда после полуночи", poster: "p8", provider: "youtube", id: "food0008", durationMin: 27 } },
  { title: "Кино на двоих", host: "igor", members: ["vera"], category: "film", startedAgoMin: 210, media: { title: "Последний рейс", poster: "p1", provider: "youtube", id: "last0009", durationMin: 101 } },
  { title: "Фоновый плейлист", host: "pasha", members: [], category: "music", startedAgoMin: 300, media: { title: "Lo-fi для работы", poster: "p5", provider: "youtube", id: "lofi0010", durationMin: 180 } },
  { title: "Ужасы на ночь", host: "katya", members: ["max"], category: "film", startedAgoMin: 380, media: { title: "Дом на краю", poster: "p2", provider: "rutube", id: "edge0011", durationMin: 94 } },
];

const filler = [
  "Вечерний чил", "Аниме-марафон", "Сериалы без спойлеров", "Разбор трейлеров", "Тихий вечер", "Кино с комментариями",
  "Музыка 90-х", "Подкаст-клуб", "Стримы и обсуждения", "Утро с кофе", "Футбольный повтор", "Мультики для взрослых",
];
const fillerPosters = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
const fillerCategories: CategoryId[] = ["film", "music", "vlog", "other"];

async function seedRoom(seed: RoomSeed, owners: Record<string, { id: string }>) {
  const host = owners[seed.host]!;
  const created = await prisma.room.create({
    data: {
      slug: newCode(), title: seed.title, hostId: host.id, ownerId: host.id, description: seed.description ?? null,
      status: "live", layout: defaultRoomLayout as object, isPublic: true, maxMembers: seed.maxMembers ?? 25,
      category: seed.category, categorySelection: "auto", createdAt: ago(seed.startedAgoMin * minute),
    },
  });
  const item = await prisma.queueItem.create({
    data: {
      roomId: created.id, url: `https://example.test/${seed.media.provider}/${seed.media.id}`, provider: seed.media.provider,
      externalId: seed.media.id, title: seed.media.title, thumbnail: poster(seed.media.poster),
      durationMs: seed.media.durationMin * minute, position: 0, addedById: host.id, inferredCategory: seed.category,
    },
  });
  await prisma.room.update({ where: { id: created.id }, data: { nowPlayingId: item.id } });
  const roster = [seed.host, ...seed.members];
  await prisma.roomMember.createMany({
    data: roster.map((key, index) => ({ roomId: created.id, userId: owners[key]!.id, role: index === 0 ? ("host" as const) : ("viewer" as const), joinedAt: ago((seed.startedAgoMin - index) * minute) })),
  });
  return created;
}

async function seedActivity(viewerId: string, partnerIds: string[]) {
  const rows: Array<{ userId: string; partnerId: string; watchDuration: number; sessionDate: Date }> = [];
  for (let back = 0; back < 90; back += 1) {
    const streak = back < 14;
    if (!streak && Math.random() > 0.62) continue;
    const sessions = streak ? 1 + (back % 3) : 1 + randomInt(2);
    for (let n = 0; n < sessions; n += 1) {
      rows.push({
        userId: viewerId, partnerId: partnerIds[randomInt(partnerIds.length)]!,
        watchDuration: 1800 + randomInt(7200), sessionDate: new Date(now - back * day - randomInt(12) * hour - n * 45 * minute),
      });
    }
  }
  await prisma.watchSession.createMany({ data: rows });
  return rows.length;
}

async function main() {
  await reset();
  const albert = await user(people.albert, { bio: "Смотрю ночные сеансы и собираю документалки", xp: 2340, totalParties: 142, totalWatchTime: 1_140_000, totalMessages: 860, roomsCreated: 23, totalReactions: 410 });
  if (profile === "empty") {
    console.log(`Seeded EMPTY profile: viewer "${people.albert}" only`);
    return;
  }

  const owners: Record<string, { id: string }> = { albert };
  for (const [key, name] of Object.entries(people)) {
    if (key !== "albert") owners[key] = await user(name, { totalParties: 20 + randomInt(80) });
  }

  for (const item of partyAchievements) {
    await prisma.achievement.create({ data: { key: item.key, titleRu: item.titleRu, titleEn: item.titleEn, descriptionRu: item.descriptionRu, descriptionEn: item.descriptionEn, icon: item.icon, xpReward: item.xpReward, points: item.xpReward, condition: item.condition } });
  }
  const catalog = await prisma.achievement.findMany({ take: 4, orderBy: { key: "asc" } });
  await prisma.userAchievement.createMany({ data: catalog.slice(0, 3).map((achievement, index) => ({ userId: albert.id, achievementId: achievement.id, pinSlot: index, awardedAt: ago((index + 1) * 3 * day) })) });

  const friendKeys = ["liza", "artem", "sonya", "dasha", "mark", "nik"] as const;
  await prisma.friendship.createMany({
    data: [
      ...friendKeys.map((key) => ({ requesterId: albert.id, addresseeId: owners[key]!.id, status: "accepted" as const })),
      { requesterId: owners.igor!.id, addresseeId: albert.id, status: "pending" as const },
    ],
  });

  for (const seed of rooms) await seedRoom(seed, owners);
  for (let index = 0; index < bulk; index += 1) {
    const host = Object.keys(people).filter((key) => key !== "albert")[index % 11]!;
    await seedRoom({
      title: `${filler[index % filler.length]} ${Math.floor(index / filler.length) + 1}`, host: host as keyof typeof people, members: [],
      category: fillerCategories[index % 4]!, startedAgoMin: 420 + index * 9,
      media: { title: `Подборка №${index + 1}`, poster: fillerPosters[index % fillerPosters.length]!, provider: "youtube", id: `fill${String(index).padStart(4, "0")}`, durationMin: 30 + (index * 7) % 90 },
    }, owners);
  }

  const lobby = await prisma.room.findFirstOrThrow({ where: { title: "Ночной кинозал" } });
  await prisma.message.createMany({
    data: [
      ["dasha", "я с попкорном, начинайте"], ["artem", "вот этот кадр с фарами — прям обои"], ["liza", "Оператор тот же, что в «Ночном рейсе»"],
      ["albert", "Ого, не знал. Надо пересмотреть"], ["mark", "кто-нибудь ещё буферится? у меня 2 сек"],
    ].map(([key, body], index) => ({ roomId: lobby.id, userId: owners[key!]!.id, body: body!, createdAt: ago((9 - index) * minute) })),
  });

  const road = rooms[0]!.media;
  await prisma.user.update({
    where: { id: albert.id },
    data: {
      lastRoomSnapshotAt: ago(40 * minute),
      lastRoomSnapshot: {
        title: "Пустая дорога", description: "", isPublic: true, maxMembers: 25, categorySelection: "auto", videoUrl: `https://example.test/${road.provider}/${road.id}`,
        inferredCategory: "film", positionMs: (72 * 60 + 44) * 1000, posterUrl: poster("p1"), durationMs: road.durationMin * minute,
        queue: [{ url: "https://example.test/youtube/rain0003", title: "Город после дождя" }, { url: "https://example.test/rutube/wood0004", title: "Лес, который помнит" }], historyCount: 3,
      },
    },
  });

  const history = [
    ["Пустая дорога — режиссёрская версия", "p1", "youtube"], ["Город после дождя", "p2", "youtube"], ["Лес, который помнит", "p3", "rutube"],
    ["Концерт на крыше — live", "p4", "vk"], ["Ночной плейлист, часть 3", "p5", "youtube"], ["Три дня на хребте", "p6", "youtube"],
    ["Холодный сектор", "p7", "youtube"], ["Уличная еда после полуночи", "p8", "youtube"],
  ] as const;
  await prisma.watchHistory.createMany({ data: history.map(([title, key, source], index) => ({ userId: albert.id, title, thumbnail: poster(key), source, videoUrl: `https://example.test/${source}/h${index}`, watchCount: 1 + (index % 4), lastWatchedAt: ago((index + 1) * 17 * hour) })) });

  const sessions = await seedActivity(albert.id, friendKeys.map((key) => owners[key]!.id));

  await prisma.notification.createMany({
    data: [
      { kind: "ROOM_INVITE", title: "Лиза начала сеанс", body: "«Ночной кинозал» · Пустая дорога", createdAt: ago(2 * minute) },
      { kind: "SYSTEM", title: "Напоминание в 22:00", body: "«Лес, который помнит» в комнате Даши", createdAt: ago(3 * hour) },
      { kind: "FRIEND_REQUEST", title: "Игорь хочет в друзья", body: "Игорь Седых отправил заявку", createdAt: ago(5 * hour) },
      { kind: "ACHIEVEMENT_UNLOCKED", title: "Достижение «Ночной экран»", body: "Вы посмотрели 10 сеансов после полуночи", createdAt: ago(day), readAt: ago(day - hour) },
      { kind: "FRIEND_ACCEPTED", title: "Соня приняла заявку", body: "Теперь вы друзья", createdAt: ago(3 * day), readAt: ago(3 * day - hour) },
      { kind: "SYSTEM", title: "Сеанс сохранён", body: "Продолжите «Пустую дорогу» с того же места", createdAt: ago(4 * day), readAt: ago(4 * day - hour) },
    ].map((row) => ({ userId: albert.id, ...row })),
  });

  console.log(`Seeded FULL profile: ${rooms.length + bulk} rooms, 12 users, ${sessions} watch sessions over 90 days, 6 notifications`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
