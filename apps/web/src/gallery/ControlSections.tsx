import { Bell, Film, Music2, Plus, Search, Settings, Trash2, UsersRound, Video } from "lucide-react";
import { Button, Chip, ChipGroup, Field, IconButton, Input, Select, Textarea } from "../ds/index.js";
import { useState } from "react";
import { Section } from "./Section.js";
import styles from "./gallery.module.css";

export function ControlSections() {
  const [filter, setFilter] = useState("all");
  const filters = [["all", "Все", undefined], ["friends", "Друзья", UsersRound], ["film", "Кино", Film], ["music", "Музыка", Music2], ["vlog", "Влоги", Video]] as const;
  return (
    <>
      <Section title="Кнопки" note="Главное действие — одна заливка акцентом на экране.">
        <div className={styles.row}>
          <Button variant="primary" icon={Plus}>Создать комнату</Button>
          <Button>Войти</Button>
          <Button variant="ghost">Отмена</Button>
          <Button variant="danger" icon={Trash2}>Удалить</Button>
        </div>
        <div className={styles.row}>
          <Button variant="primary" size="sm">Зайти</Button>
          <Button size="sm">Позвать</Button>
          <Button variant="primary" size="lg">Продолжить сеанс</Button>
          <Button variant="primary" loading>Сохраняем</Button>
          <Button disabled>Недоступно</Button>
        </div>
        <div className={styles.row}>
          <IconButton icon={Bell} label="Уведомления" />
          <IconButton icon={Settings} label="Настройки" variant="ghost" />
          <IconButton icon={Search} label="Поиск" variant="primary" />
          <IconButton icon={Trash2} label="Удалить" variant="danger" size="sm" />
        </div>
      </Section>

      <Section title="Поля" note="Одна рамка у контейнера: нет двойной обводки у поиска.">
        <Field label="Название комнаты" hint="Видно всем, кто зайдёт по коду">
          <Input placeholder="Ночной кинозал" defaultValue="Ночной кинозал" />
        </Field>
        <Field label="Поиск">
          <Input icon={Search} placeholder="Найти видео или комнату" />
        </Field>
        <Field label="Код комнаты" error="В коде шесть знаков, без 0, O, 1, I и L">
          <Input defaultValue="7KQ-2" />
        </Field>
        <Field label="Доступ">
          <Select defaultValue="code"><option value="code">По коду</option><option value="friends">Только друзья</option><option value="public">Открытая</option></Select>
        </Field>
        <Field label="Описание">
          <Textarea defaultValue="Субботний сеанс, начинаем в 22:00" />
        </Field>
      </Section>

      <Section title="Чипы и фильтры">
        <ChipGroup label="Фильтр комнат">
          {filters.map(([id, label, icon]) => <Chip key={id} icon={icon} selected={filter === id} onClick={() => setFilter(id)}>{label}</Chip>)}
        </ChipGroup>
        <ChipGroup label="Источники">
          <Chip selected count={12}>YouTube</Chip><Chip count={4}>VK</Chip><Chip>Rutube</Chip><Chip>Прямая ссылка</Chip>
        </ChipGroup>
      </Section>
    </>
  );
}
