import { useEffect, useState } from "react";
import { apiUrl } from "../api/client.js";
import { useI18n } from "../i18n/context.js";

type Tab = "users" | "rooms" | "reports" | "audit";

const roleLabels: Record<string, string> = { USER: "Пользователь", ADMIN: "Администратор", SUPERADMIN: "Суперадмин" };
const statusLabels: Record<string, string> = { open: "Открыта", live: "В эфире", ended: "Завершена", pending: "Ожидает", reviewed: "Рассмотрено" };

function humanValue(value: string | null | undefined): string {
  if (!value) return "";
  return roleLabels[value] ?? statusLabels[value] ?? value;
}

export function AdminScreen({ token }: { token: string }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("users");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [rows, setRows] = useState<Array<Record<string, string | null>>>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (query.trim()) params.set("q", query.trim());
    if (tab === "reports") params.set("status", "open");
    void fetch(`${apiUrl}/admin/${tab}?${params.toString()}`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { pages?: number; users?: Array<Record<string, string | null>>; rooms?: Array<Record<string, string | null>>; reports?: Array<Record<string, string | null>>; audit?: Array<Record<string, string | null>> }) => {
        setPages(payload.pages ?? 1);
        setRows(payload.users ?? payload.rooms ?? payload.reports ?? payload.audit ?? []);
      })
      .catch(() => setRows([]));
  }, [page, query, reloadKey, tab, token]);

  async function act(path: string, body: unknown) {
    await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    setReloadKey((value) => value + 1);
  }

  return (
    <section className="tr-lobby" data-testid="admin-screen">
      <h2>{t("admin.title")}</h2>
      <div className="tr-inline-actions">
        {(["users", "rooms", "reports", "audit"] as const).map((name) => (
          <button key={name} type="button" className="tr-text-button" onClick={() => { setTab(name); setPage(0); }}>
            {t(`admin.${name}`)}
          </button>
        ))}
      </div>
      <label>
        {t("admin.search")}
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
      </label>
      <table>
        <tbody>
          {rows.length === 0 ? <tr><td>{t("admin.empty")}</td></tr> : null}
          {rows.map((row) => (
            <tr key={String(row.id)}>
              <td>{row.displayName ?? row.title ?? row.action ?? row.reason}</td>
              <td>{humanValue(row.status ?? row.role)}</td>
              <td>
                {tab === "users" ? (
                  <button type="button" className="tr-text-button" onClick={() => void act(`/admin/users/${row.id}/ban`, { reason: "admin" })}>{t("admin.ban")}</button>
                ) : null}
                {tab === "rooms" ? (
                  <button type="button" className="tr-text-button" onClick={() => void act(`/admin/rooms/${row.id}/close`, {})}>{t("admin.close")}</button>
                ) : null}
                {tab === "reports" ? (
                  <button type="button" className="tr-text-button" onClick={() => void act(`/admin/reports/${row.id}`, { status: "reviewed" })}>{t("admin.resolve")}</button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="tr-text-button" disabled={page <= 0} onClick={() => setPage((value) => value - 1)}>{t("admin.prev")}</button>
      <span>{page + 1}/{pages}</span>
      <button type="button" className="tr-text-button" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>{t("admin.next")}</button>
    </section>
  );
}
