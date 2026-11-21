import { useEffect, useState } from "react";
import { apiUrl } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import type { MessageKey } from "../i18n/ru.js";
import { AppShell } from "../shell/AppShell.js";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Input, useToast } from "../ui/index.js";

type Tab = "users" | "rooms" | "reports" | "audit";

const tabKeys: Record<Tab, MessageKey> = {
  users: "admin.users",
  rooms: "admin.rooms",
  reports: "admin.reports",
  audit: "admin.audit",
};

const roleKeys = {
  USER: "admin.role.user",
  ADMIN: "admin.role.admin",
  SUPERADMIN: "admin.role.superadmin",
} as const;
const statusKeys = {
  open: "admin.status.open",
  live: "admin.status.live",
  ended: "admin.status.ended",
  pending: "admin.status.pending",
  reviewed: "admin.status.reviewed",
} as const;

export function AdminScreen({ token }: { token: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("users");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [rows, setRows] = useState<Array<Record<string, string | null>>>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<{ path: string; body: unknown; title: string; bodyText: string } | null>(null);
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
      .then((payload: { pages?: number; users?: Array<Record<string, string | null>>; rooms?: Array<Record<string, string | null>>; reports?: Array<Record<string, string | null>>; audit?: Array<Record<string, string | null>> }) => {
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

  function actionFor(row: Record<string, string | null>): { label: string; path: string; body: unknown; title: string; bodyText: string } | null {
    if (tab === "users") {
      return {
        label: t("admin.ban"),
        path: `/admin/users/${row.id}/ban`,
        body: { reason: "admin" },
        title: `${t("admin.ban")}?`,
        bodyText: row.displayName ?? "",
      };
    }
    if (tab === "rooms") {
      return {
        label: t("admin.close"),
        path: `/admin/rooms/${row.id}/close`,
        body: {},
        title: `${t("admin.close")}?`,
        bodyText: row.title ?? "",
      };
    }
    if (tab === "reports") {
      return {
        label: t("admin.resolve"),
        path: `/admin/reports/${row.id}`,
        body: { status: "reviewed" },
        title: `${t("admin.resolve")}?`,
        bodyText: row.reason ?? "",
      };
    }
    return null;
  }

  return (
    <AppShell view="admin" className="admin-shell">
      <section className="wrap admin-page" data-testid="admin-screen">
        <main>
          <header className="admin-head">
            <h1>{t("admin.title")}</h1>
            <div className="tabs" role="tablist" aria-label={t("admin.title")}>
              {(["users", "rooms", "reports", "audit"] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={tab === name}
                  className={tab === name ? "tab on" : "tab"}
                  onClick={() => {
                    setTab(name);
                    setPage(0);
                  }}
                >
                  {t(tabKeys[name])}
                </button>
              ))}
            </div>
          </header>

          <Input
            label={t("admin.search")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder={t("admin.search")}
          />

          <Card title={t(tabKeys[tab])} action={<Badge count={rows.length} tone="neutral" />}>
            {failed ? (
              <EmptyState
                title={t("admin.failed")}
                action={<Button onClick={() => setReloadKey((value) => value + 1)}>{t("admin.retry")}</Button>}
              />
            ) : rows.length === 0 ? (
              <EmptyState title={t("admin.empty")} />
            ) : (
              <div className="admin-table" role="table">
                {rows.map((row) => {
                  const action = actionFor(row);
                  return (
                    <div key={String(row.id)} className="admin-row" role="row">
                      <span role="cell">{row.displayName ?? row.title ?? row.action ?? row.reason}</span>
                      <Badge tone={tab === "reports" ? "social" : "neutral"}>{humanValue(row.status ?? row.role)}</Badge>
                      {action ? (
                        <Button size="sm" variant="danger" onClick={() => setPending(action)}>
                          {action.label}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="admin-pager">
            <Button size="sm" variant="outline" disabled={page <= 0} onClick={() => setPage((value) => value - 1)}>
              {t("admin.prev")}
            </Button>
            <span>
              {page + 1}/{pages}
            </span>
            <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>
              {t("admin.next")}
            </Button>
          </div>
        </main>
      </section>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        body={pending?.bodyText ?? ""}
        confirmLabel={pending ? t("admin.confirm") : ""}
        danger
        busy={busy}
        onConfirm={() => void act()}
        onCancel={() => setPending(null)}
      />
    </AppShell>
  );
}
