/** Deterministic data for `?shot=` design previews used by visual tests. */
export const shotRooms = [
  { id: "shot-cinema", title: "Вечерний зал", code: "7kq2mx", memberCount: 4 },
  { id: "shot-music", title: "Музыка до утра", code: "9wp4vz", memberCount: 3 },
  { id: "shot-serial", title: "Сериал в четыре глаза", code: "3tf8bn", memberCount: 2 },
];

export const shotPeople = [
  { id: "liza", name: "Лиза" },
  { id: "sonya", name: "Соня" },
  { id: "dasha", name: "Даша" },
  { id: "nick", name: "Ник" },
];

export const shotHeat = Array.from({ length: 49 }, (_, index) => ({
  day: new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10),
  score: [0, 1, 2, 3, 4, 0, 2, 1, 0, 3][index % 10] ?? 0,
}));

export const posterClasses = ["poster-sunset", "poster-neon", "poster-forest", "poster-concert", "poster-night"] as const;
