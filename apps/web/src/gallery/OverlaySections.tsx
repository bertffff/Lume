import { Bell } from "lucide-react";
import { useState } from "react";
import { Avatar, Button, IconButton, List, ListRow, Modal, Popover, Tabs, Field, Input } from "../ds/index.js";
import { Section } from "./Section.js";
import styles from "./gallery.module.css";

const notifications = [
  { name: "Лиза Морозова", title: "Лиза начала сеанс", body: "«Ночной кинозал» · Пустая дорога", time: "2 мин" },
  { name: "Даша Лисицына", title: "Напоминание в 22:00", body: "«Лес, который помнит»", time: "3 ч" },
  { name: "Игорь Седых", title: "Игорь хочет в друзья", body: "Принять или отклонить заявку", time: "5 ч" },
];

export function OverlaySections({ defaultModalOpen }: { defaultModalOpen: boolean }) {
  const [modal, setModal] = useState(defaultModalOpen);
  return (
    <>
      <Section title="Табы" note="Стрелки, Home и End переключают вкладку.">
        <Tabs
          label="Панель комнаты"
          defaultValue="people"
          tabs={[
            { id: "chat", label: "Чат", count: 12, panel: <p className={styles.t2}>Сообщения комнаты.</p> },
            { id: "people", label: "Люди", count: 6, panel: <List label="Участники"><ListRow leading={<Avatar name="Лиза Морозова" size="sm" presence="online" />} title="Лиза Морозова" subtitle="ведущая · говорит" /><ListRow leading={<Avatar name="Марк Орлов" size="sm" />} title="Марк Орлов" subtitle="микрофон выкл." /></List> },
            { id: "queue", label: "Очередь", count: 3, panel: <p className={styles.t2}>Дальше: Город после дождя.</p> },
          ]}
        />
      </Section>

      <Section title="Поповер" note="Панель уведомлений: до 360 px, Esc закрывает и возвращает фокус.">
        <div className={styles.popoverSlot}>
          <Popover
            label="Уведомления"
            defaultOpen
            trigger={(props) => <IconButton icon={Bell} label="Уведомления" {...props} />}
          >
            <div className={styles.popoverBody}>
              <List label="Уведомления">
                {notifications.map((item) => (
                  <ListRow key={item.title} leading={<Avatar name={item.name} size="sm" />} title={item.title} subtitle={item.body} trailing={<span className={styles.t3}>{item.time}</span>} />
                ))}
              </List>
            </div>
          </Popover>
        </div>
      </Section>

      <Section title="Модалка">
        <div className={styles.row}><Button onClick={() => setModal(true)}>Войти по коду</Button></div>
        <Modal
          open={modal}
          title="Войти по коду"
          size="sm"
          onClose={() => setModal(false)}
          footer={<><Button variant="ghost" onClick={() => setModal(false)}>Отмена</Button><Button variant="primary">Войти</Button></>}
        >
          <Field label="Код комнаты" hint="Шесть знаков из приглашения">
            <Input defaultValue="7KQ-2MX" />
          </Field>
        </Modal>
      </Section>
    </>
  );
}
