import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import "./profile-view.css";

const tabs = ["overview", "history", "friends", "awards"] as const;
type ProfileTab = (typeof tabs)[number];

interface ProfileKpi {
  label: string;
  value: ReactNode;
}

interface ProfileSeasonDay {
  /** ISO calendar date (YYYY-MM-DD) from the studio dataset. */
  day: string;
  score: number;
}

export interface ProfileViewProps {
  labels: {
    tabsLabel: string;
    tabs: Readonly<Record<ProfileTab, string>>;
    season: string;
    seasonEmpty: string;
    seasonScore: (score: number) => string;
  };
  locale: string;
  profileCard: ReactNode;
  achievements: ReactNode;
  kpis: readonly [ProfileKpi, ProfileKpi, ProfileKpi];
  season: readonly ProfileSeasonDay[];
  seasonSummary?: ReactNode;
  settings: ReactNode;
  overviewExtra?: ReactNode;
  history: ReactNode;
  friends: ReactNode;
  awards: ReactNode;
}

function ProfileSeason({ labels, locale, season, seasonSummary }: Pick<
  ProfileViewProps,
  "labels" | "locale" | "season" | "seasonSummary"
>) {
  const id = useId();
  const [focusedDay, setFocusedDay] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const activeDay = hoveredDay ?? focusedDay;
  // Calendar days from the API are UTC keys, not local-midnight timestamps.
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" });
  const cells = season.map(({ day, score }) => ({
    day,
    score,
    dateText: dateFormat.format(new Date(`${day}T00:00:00Z`)),
    scoreText: labels.seasonScore(score),
    descriptionId: `${id}-${day}`,
  }));

  return (
    <section
      className="profile-view__season"
      aria-labelledby={`${id}-heading`}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || activeDay === null) return;
        setFocusedDay(null);
        setHoveredDay(null);
        event.stopPropagation();
      }}
    >
      <h2 id={`${id}-heading`}>{labels.season}</h2>
      {seasonSummary}
      {cells.length ? (
        <ul className="profile-view__season-grid" role="list">
          {cells.map(({ day, score, dateText, scoreText, descriptionId }) => (
            <li key={day} onMouseLeave={() => setHoveredDay(null)}>
              <button
                type="button"
                className="profile-view__day"
                data-intensity={score > 3 ? "high" : score > 0 ? "low" : "none"}
                aria-label={dateText}
                aria-describedby={descriptionId}
                onMouseEnter={() => setHoveredDay(day)}
                onFocus={() => {
                  setFocusedDay(day);
                  setHoveredDay(null);
                }}
                onBlur={() => setFocusedDay(null)}
                onClick={(event) => {
                  event.currentTarget.focus();
                  setFocusedDay(day);
                  setHoveredDay(null);
                }}
              >
                {day.slice(-2)}
              </button>
              <div className="profile-view__season-readout" id={descriptionId} role="tooltip" hidden={day !== activeDay}>
                <time dateTime={day} aria-hidden="true">{dateText}</time>
                <span>{scoreText}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : <p>{labels.seasonEmpty}</p>}
    </section>
  );
}

export function ProfileView(props: ProfileViewProps) {
  const id = useId();
  const [selected, setSelected] = useState<ProfileTab>("overview");
  const tabRefs = useRef<Partial<Record<ProfileTab, HTMLButtonElement | null>>>({});

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowLeft": nextIndex = (index - 1 + tabs.length) % tabs.length; break;
      case "ArrowRight": nextIndex = (index + 1) % tabs.length; break;
      case "Home": nextIndex = 0; break;
      case "End": nextIndex = tabs.length - 1; break;
      default: return;
    }
    const next = tabs[nextIndex];
    if (!next) return;
    event.preventDefault();
    setSelected(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="profile-view">
      <aside className="profile-view__sidebar">
        {props.profileCard}
        {props.achievements}
      </aside>
      <div className="profile-view__workspace">
        <div className="profile-view__tabs" role="tablist" aria-label={props.labels.tabsLabel}>
          {tabs.map((tab, index) => (
            <button
              key={tab}
              id={`${id}-tab-${tab}`}
              ref={(node) => { tabRefs.current[tab] = node; }}
              type="button"
              role="tab"
              aria-controls={`${id}-panel-${tab}`}
              aria-selected={selected === tab}
              tabIndex={selected === tab ? 0 : -1}
              onClick={() => setSelected(tab)}
              onKeyDown={(event) => handleTabKey(event, index)}
            >
              {props.labels.tabs[tab]}
            </button>
          ))}
        </div>
        {tabs.map((tab) => (
          <div
            key={tab}
            className="profile-view__panel"
            role="tabpanel"
            id={`${id}-panel-${tab}`}
            aria-labelledby={`${id}-tab-${tab}`}
            tabIndex={0}
            hidden={selected !== tab}
          >
            {tab === "overview" ? (
              <>
                <dl className="profile-view__kpis">
                  {props.kpis.map(({ label, value }) => (
                    <div className="profile-view__kpi" key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <ProfileSeason
                  labels={props.labels}
                  locale={props.locale}
                  season={props.season}
                  seasonSummary={props.seasonSummary}
                />
                {props.settings}
                {props.overviewExtra}
              </>
            ) : props[tab]}
          </div>
        ))}
      </div>
    </div>
  );
}
