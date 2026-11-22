/** Definitions only. Awarding them is a later job, not a payment. */
export const achievementCatalog = [
  {
    key: "first_room",
    titleRu: "Первый зал",
    titleEn: "First room",
    descriptionRu: "Открыть комнату совместного просмотра.",
    descriptionEn: "Open a watch room.",
    points: 10,
  },
  {
    key: "night_owl",
    titleRu: "Ночной сеанс",
    titleEn: "Night screening",
    descriptionRu: "Досмотреть вместе после полуночи.",
    descriptionEn: "Finish a watch together after midnight.",
    points: 15,
  },
  {
    key: "good_host",
    titleRu: "Хозяин зала",
    titleEn: "Good host",
    descriptionRu: "Провести сеанс, где гости дождались титров.",
    descriptionEn: "Host a session that reaches the credits.",
    points: 25,
  },
] as const;
