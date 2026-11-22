import { useEffect, useState } from "react";
import { apiUrl } from "../api/client.js";
import { Badge, Button, Card, Field, Input, List, ListRow, Modal, State, Tabs, useToast } from "../ds/index.js";
import { useI18n } from "../i18n/context.js";
import type { MessageKey } from "../i18n/ru.js";
import { AppShell } from "../shell/AppShell.js";
import styles from "./AdminScreen.module.css";

type Tab = "users" | "rooms" | "reports" | "audit";
type Row = Record<string, string | null>;
interface Pending { path: string; body: unknown; title: string; bodyText: string }

const tabKeys: Record<Tab, MessageKey> = { users: "admin.users", rooms: "admin.rooms", reports: "admin.reports", audit: "admin.audit" };
const tabs = ["users", "rooms", "reports", "audit"] as const;
const roleKeys = { USER: "admin.role.user", ADMIN: "admin.role.admin", SUPERADMIN: "admin.role.superadmin" } as const;
const statusKeys = { open: "admin.status.open", live: "admin.status.live", ended: "admin.status.ended", pending: "admin.status.pending", reviewed: "admin.status.reviewed" } as const;

/** Operator view: one table per tab, a search box, paging, and a confirm step before anything destructive. */
export function AdminScreen({ token }: { token: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("users");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (query.trim()) params.set("q", query.trim());
    if (tab === "reports") params.set("status", "open");
    setFailed(false);
    void fetch(`${apiUrl}/admin/${tab}?${params.toString()}`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!response.ok) throw new Error("admin_failed");
        return response.json();
      })
      .then((payload: { pages?: number; users?: Row[]; rooms?: Row[]; reports?: Row[]; audit?: Row[] }) => {
        setPages(payload.pages ?? 1);
        setRows(payload.users ?? payload.rooms ?? payload.reports ?? payload.audit ?? []);
      })
      .catch(() => {
        setRows([]);
        setFailed(true);
      });
  }, [page, query, reloadKey, tab, token]);

  async function act() {
    if (!pending) return;
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}${pending.path}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(pending.body),
      });
      if (!response.ok) throw new Error("admin_failed");
      toast.push(t("admin.done"), "success");
      setReloadKey((value) => value + 1);
    } catch {
      toast.push(t("admin.failed"), "danger");
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  function humanValue(value: string | null | undefined): string {
    if (!value) return "";
    if (value in roleKeys) return t(roleKeys[value as keyof typeof roleKeys]);
    if (value in statusKeys) return t(statusKeys[value as keyof typeof statusKeys]);
    return value;
  }

  function actionFor(row: Row): (Pending & { label: string }) | null {
    if (tab === "users") return { label: t("admin.ban"), path: `/admin/users/${row.id}/ban`, body: { reason: "admin" }, title: `${t("admin.ban")}?`, bodyText: row.displayName ?? "" };
    if (tab === "rooms") return { label: t("admin.close"), path: `/admin/rooms/${row.id}/close`, body: {}, title: `${t("admin.close")}?`, bodyText: row.title ?? "" };
    if (tab === "reports") return { label: t("admin.resolve"), path: `/admin/reports/${row.id}`, body: { status: "reviewed" }, title: `${t("admin.resolve")}?`, bodyText: row.reason ?? "" };
    return null;
  }

  const table = failed ? (
    <State kind="error" compact bare title={t("admin.failed")} action={<Button onClick={() => setReloadKey((value) => value + 1)}>{t("admin.retry")}</Button>} />
  ) : rows.length === 0 ? (
    <State kind="empty" compact bare title={t("admin.empty")} />
  ) : (
    <List label={t(tabKeys[tab])}>
      {rows.map((row) => {
        const action = actionFor(row);
        return (
          <ListRow
            key={String(row.id)}
            title={String(row.displayName ?? row.title ?? row.action ?? row.reason ?? "")}
            trailing={
              <span className={styles.trailing}>
                <Badge tone={tab === "reports" ? "info" : "neutral"}>{humanValue(row.status ?? row.role)}</Badge>
                {action ? <Button size="sm" variant="danger" onClick={() => setPending(action)}>{action.label}</Button> : null}
              </span>
            }
          />
        );
      })}
    </List>
  );

  return (
    <AppShell view="admin" className="admin-shell">
      <section className={styles.root} data-testid="admin-screen">
        <h1 className={styles.title}>{t("admin.title")}</h1>
        <Tabs
          label={t("admin.title")}
          value={tab}
          onChange={(id) => { setTab(id as Tab); setPage(0); }}
          tabs={tabs.map((name) => ({
            id: name,
            label: t(tabKeys[name]),
            panel: (
              <div className={styles.panel}>
                <Field label={t("admin.search")}>
                  <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder={t("admin.search")} />
                </Field>
                <Card as="section" aria-label={t(tabKeys[name])}>{table}</Card>
                <div className={styles.pager}>
                  <Button size="sm" disabled={page <= 0} onClick={() => setPage((value) => value - 1)}>{t("admin.prev")}</Button>
                  <span className={styles.page}>{page + 1}/{pages}</span>
                  <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>{t("admin.next")}</Button>
                </div>
              </div>
            ),
          }))}
        />
      </section>
      <Modal
        open={pending !== null}
        size="sm"
        title={pending?.title ?? ""}
        onClose={() => setPending(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>{t("common.cancel")}</Button>
            <Button variant="danger" loading={busy} onClick={() => void act()}>{pending ? t("admin.confirm") : ""}</Button>
          </>
        }
      >
        <p className={styles.confirm}>{pending?.bodyText}</p>
      </Modal>
    </AppShell>
  );
}
