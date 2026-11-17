export const demoFriends = [
  { hue: "lisa", name: "Лиза", note: "ведёт «Ночной кинозал»", go: true },
  { hue: "artem", name: "Артём", note: "в «Ночном кинозале»", go: true },
  { hue: "sonya", name: "Соня", note: "в «Пятничном звуке»", go: false },
  { hue: "nick", name: "Ник", note: "был час назад", go: false },
] as const;

export const demoRooms = [
  { title: "Пятничный звук", sub: "Концерт на крыше", poster: "/dev-seed/concert.jpg", count: "38 смотрят", hue: "sonya" },
  { title: "Нуар по средам", sub: "Город после дождя", poster: "/dev-seed/rain.jpg", count: "12 смотрят", hue: "nick" },
  { title: "Документалки", sub: "Лес, который помнит", poster: "/dev-seed/forest.jpg", count: "в 22:00", hue: "dasha" },
] as const;

export const demoMessages = [
  { system: true, text: "Марк зашёл в комнату" },
  { hue: "dasha", name: "Даша", body: "я с попкорном, начинайте" },
  { system: true, text: "Лиза поставила на паузу · 01:02:10" },
  { hue: "artem", name: "Артём", body: "вот этот кадр с фарами — прям обои" },
  { hue: "lisa", name: "Лиза", body: "Оператор тот же, что в «Ночном рейсе»", host: true },
  { mine: true, body: "Ого, не знал. Надо пересмотреть" },
  { hue: "mark", name: "Марк", body: "кто-нибудь ещё буферится? у меня 2 сек" },
] as const;
