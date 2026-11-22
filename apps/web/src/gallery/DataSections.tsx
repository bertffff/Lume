import { Clock, Plus } from "lucide-react";
import { Avatar, AvatarStack, Badge, Button, Card, CardHeader, CodeBadge, List, ListRow, Poster, Progress } from "../ds/index.js";
import { Section } from "./Section.js";
import styles from "./gallery.module.css";

const posterBase = "http://127.0.0.1:33199";
const friends = [
  { name: "Лиза Морозова", room: "Ночной кинозал", presence: "online" as const },
  { name: "Артём Теплов", room: "Ночной кинозал", presence: "online" as const },
  { name: "Соня Нечаева", room: "Пятничный звук", presence: "online" as const },
  { name: "Ник Рябов", room: "был час назад", presence: "offline" as const },
];

export function DataSections() {
  return (
    <>
      <Section title="Карточки" note="flat, raised и единственная акцентная заливка на экране.">
        <Card pad="lg" tone="accent" interactive>
          <div className={styles.cta}><Plus size={24} aria-hidden="true" /><strong className={styles.ctaTitle}>Создать комнату</strong><span>Ссылка, друзья — и смотрим</span></div>
        </Card>
        <Card tone="raised">
          <CardHeader title="Продолжить" meta="40 минут назад" />
          <p className={styles.cardText}>Пустая дорога — режиссёрская версия</p>
          <Progress value={0.59} label="Просмотрено 59%" />
          <span className={styles.t3}>01:12:44 из 02:03:10</span>
        </Card>
        <Card>
          <CardHeader title="Ваш сезон" meta="14 дней подряд" />
          <p className={styles.t2}>142 сеанса в этом году</p>
        </Card>
      </Section>

      <Section title="Список" note="Друзья онлайн: аватар, строка состояния, одно действие справа.">
        <Card pad="sm">
          <List label="Друзья онлайн">
            {friends.map((friend) => (
              <ListRow
                key={friend.name}
                leading={<Avatar name={friend.name} presence={friend.presence} />}
                title={friend.name}
                subtitle={friend.presence === "online" ? `в «${friend.room}»` : friend.room}
                trailing={friend.presence === "online" ? <Button size="sm" variant="primary">Зайти</Button> : <Button size="sm" variant="ghost">Позвать</Button>}
              />
            ))}
          </List>
        </Card>
      </Section>

      <Section title="Постер, код, аватар">
        <div className={styles.posters}>
          <Poster category="film" src={`${posterBase}/p1-road.jpg`}><Badge tone="media">2:03:10</Badge></Poster>
          <Poster category="music" src={`${posterBase}/p4-concert.jpg`}><Badge tone="media">В эфире</Badge></Poster>
          <Poster category="vlog"><Clock size={14} aria-hidden="true" /><span className={styles.mono}>27:00</span></Poster>
          <Poster category="other" />
        </div>
        <div className={styles.row}>
          <CodeBadge code="7KQ2MX" /><CodeBadge code="khypgv" copyable />
        </div>
        <div className={styles.row}>
          <Avatar name="Альберт Вопилов" size="sm" /><Avatar name="Лиза Морозова" /><Avatar name="Марк Орлов" size="lg" presence="online" /><Avatar name="Даша Лисицына" size="lg" speaking />
          <AvatarStack names={["Лиза", "Артём", "Марк", "Даша", "Соня", "Ник"]} max={4} />
        </div>
        <div className={styles.row}>
          <Badge>Нейтральный</Badge><Badge tone="accent">Ведущий</Badge><Badge tone="success">В сети</Badge><Badge tone="warn">Медленный режим</Badge><Badge tone="danger">Ошибка</Badge><Badge tone="info">Подсказка</Badge>
        </div>
      </Section>
    </>
  );
}
