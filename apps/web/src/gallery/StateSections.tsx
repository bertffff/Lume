import { Button, Card, Skeleton, State } from "../ds/index.js";
import { Section } from "./Section.js";
import styles from "./gallery.module.css";

export function StateSections() {
  return (
    <>
      <Section title="Загрузка" note="Скелетон повторяет форму будущего контента." wide>
        <div className={styles.skeletons} aria-busy="true">
          <Card pad="sm"><div className={styles.skelCard}><Skeleton shape="poster" /><Skeleton shape="title" /><Skeleton /></div></Card>
          <Card pad="sm"><div className={styles.skelCard}><Skeleton shape="poster" /><Skeleton shape="title" /><Skeleton /></div></Card>
          <Card pad="sm"><div className={styles.row}><Skeleton shape="circle" /><div className={styles.grow}><Skeleton shape="title" /><Skeleton /></div></div></Card>
        </div>
      </Section>

      <Section title="Пусто и ошибка" note="Пусто — приглашение к действию. Ошибка — что случилось и что делать." wide>
        <div className={styles.states}>
          <State kind="empty" title="Пока нет открытых комнат" body="Создайте первую — друзья увидят её здесь." action={<Button variant="primary" size="sm">Создать комнату</Button>} />
          <State kind="error" title="Не удалось загрузить комнаты" body="Сервер не ответил. Проверьте соединение и повторите." action={<Button size="sm">Повторить</Button>} />
          <State kind="offline" title="Нет соединения" body="Комната дождётся, когда вы вернётесь." action={<Button size="sm">Повторить</Button>} />
          <State kind="forbidden" title="Нет доступа" body="Комната закрыта для вашего аккаунта." />
          <State kind="missing" title="Комната не найдена" body="Код 7KQ-2MX не существует или сеанс закончился." action={<><Button size="sm">На главную</Button><Button variant="primary" size="sm">Создать комнату</Button></>} />
          <State compact kind="error" title="Видео недоступно" body="Источник не отвечает. Ведущая может обновить ссылку." />
        </div>
      </Section>
    </>
  );
}
