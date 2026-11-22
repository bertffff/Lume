import { Film, Play, Settings, Users } from "lucide-react";
import { Icon } from "../ds/index.js";
import { Section } from "./Section.js";
import styles from "./gallery.module.css";

const surfaces = [["bg", styles.swBg], ["surface-1", styles.swS1], ["surface-2", styles.swS2], ["surface-3", styles.swS3]] as const;
const statuses = [["accent", styles.swAccent], ["success", styles.swSuccess], ["warn", styles.swWarn], ["danger", styles.swDanger], ["info", styles.swInfo]] as const;
const people = [styles.p1, styles.p2, styles.p3, styles.p4, styles.p5, styles.p6, styles.p7, styles.p8];
const heat = [styles.heat0, styles.heat1, styles.heat2, styles.heat3, styles.heat4];
const spaces = [["4", styles.sp1], ["8", styles.sp2], ["12", styles.sp3], ["16", styles.sp4], ["24", styles.sp6], ["32", styles.sp8], ["48", styles.sp12], ["64", styles.sp16]] as const;
const radii = [["control", styles.rControl], ["card", styles.rCard], ["sheet", styles.rSheet], ["chip", styles.rChip]] as const;

export function TokenSections() {
  return (
    <>
      <Section title="Поверхности и текст" note="Три уровня поверхности, три уровня текста, одна рамка.">
        <div className={styles.row}>
          {surfaces.map(([name, cls]) => <div key={name} className={`${styles.swatch} ${cls}`}><span>{name}</span></div>)}
        </div>
        <div className={styles.textStack}>
          <span className={styles.t1}>Основной текст — названия, действия</span>
          <span className={styles.t2}>Вторичный — описания, подписи к данным</span>
          <span className={styles.t3}>Третичный — время, служебная мета</span>
        </div>
      </Section>

      <Section title="Акцент и статусы" note="Акцент один. Статусы красят только точку, иконку и строку текста.">
        <div className={styles.row}>
          {statuses.map(([name, cls]) => <div key={name} className={`${styles.swatch} ${cls}`}><span>{name}</span></div>)}
        </div>
        <div className={styles.row}>
          {people.map((cls, index) => <span key={cls} className={`${styles.person} ${cls}`}>{index + 1}</span>)}
        </div>
        <div className={styles.row} aria-label="Тепловая карта: производная от акцента">
          {heat.map((cls) => <span key={cls} className={`${styles.cell} ${cls}`} />)}
        </div>
      </Section>

      <Section title="Типографика" note="12 / 14 / 16 / 20 / 28 / 40. Две гарнитуры + моно для кодов.">
        <p className={styles.fsDisplay}>Смотрим вместе</p>
        <p className={styles.fsHeadline}>Добрый вечер, Альберт</p>
        <p className={styles.fsTitle}>Открытые комнаты</p>
        <p className={styles.fsBody}>Основной текст читается без усилий: 16 пикселей, межстрочный 24.</p>
        <p className={styles.fsSmall}>Плотные списки и поля — 14 пикселей. Основной текст не мельче.</p>
        <p className={styles.fsCaption}>12 пикселей — только время и служебные подписи</p>
        <p className={styles.fsMono}>7KQ-2MX · 01:12:44 · NORMAL</p>
      </Section>

      <Section title="Сетка 4/8, радиусы, иконки">
        <div className={styles.spaceRow}>
          {spaces.map(([label, cls]) => <div key={label} className={styles.spaceItem}><span className={`${styles.bar} ${cls}`} /><span className={styles.t3}>{label}</span></div>)}
        </div>
        <div className={styles.row}>
          {radii.map(([name, cls]) => <div key={name} className={`${styles.radius} ${cls}`}><span>{name}</span></div>)}
        </div>
        <div className={styles.row}>
          <Icon icon={Play} size="sm" /><Icon icon={Film} size="md" /><Icon icon={Users} size="lg" /><Icon icon={Settings} size="md" />
          <span className={styles.t3}>lucide · 16 / 20 / 24</span>
        </div>
      </Section>
    </>
  );
}
