# E2E isolation (v1) — safety, reproduction, evidence

_Last verified 2026-11-22 on `cursor/lume-greenfield-87d4`._

Browser acceptance must never share infrastructure with the developer's
Postgres/Redis or with the API integration suite. This document records the
rules, the reproducible local runner, the CI wiring, and the evidence.

## Safety rules

1. **No defaults for destructive targets.** `E2E_DATABASE_URL` and
   `E2E_REDIS_URL` have no fallback. Omitting either exits 1 before any socket
   is opened (`apps/api/scripts/e2e-target.ts` is pure).
2. **Positively disposable database.** The name must be a simple identifier
   containing an `e2e` segment (e.g. `lume_e2e_task0`). `lume`, `lume_test`,
   `postgres`, `template*` and quoted/injectable names are rejected.
3. **Default ports are refused everywhere.** Port `5432` (Postgres) and `6379`
   (Redis) are rejected on *any* hostname, including remote hosts — not just
   the occupied local defaults. An absent port is treated as the default and
   refused.
4. **Local process only.** Even on an alternate port, a non-loopback host
   (`db.internal`, a public IP, …) is rejected. Only `127.0.0.1`, `localhost`
   and `::1` are accepted.
5. **Loopback-only bindings.** `E2E_HOST` was removed; `e2e/helpers/config.ts`
   hardcodes `127.0.0.1`, the web preview binds `--host 127.0.0.1`, and the API
   / realtime servers receive `API_HOST=127.0.0.1` / `REALTIME_HOST=127.0.0.1`.
   The explicit `127.0.0.1:` container bindings in the **local** `docker run`
   reproduction below are a local-Docker instruction only; CI uses GitHub
   Actions service port mappings (see CI wiring).
6. **Separate API and E2E fixtures.** API integration tests stay serialized
   (`vitest.config.ts`) and create a fresh `lume_api_test_<suffix>` on their
   own alternate-port Postgres service. They do not drop or reuse a database.
   Playwright uses its own cluster and an `e2e` database name. Do not run API
   tests and the E2E build simultaneously in the same checkout.
7. **Build-time origins are authoritative.** `VITE_API_URL` /
   `VITE_REALTIME_URL` are baked into the web build and hashed in
   `turbo.json`, so a stale cached `dist` cannot point at old ports.

`apps/api/scripts/check-e2e-target.ts` performs rules 1–4 as a safe preflight:
no connections, no credentials in its output.

## Reproduce locally

```bash
cd /home/korebit/Applications/Lume

# 1) NEW disposable containers, loopback-published, no volumes, unique names.
docker run -d --name lume-task0-<suffix>-pg \
  -e POSTGRES_USER=e2e -e POSTGRES_PASSWORD=e2e-local-only -e POSTGRES_DB=postgres \
  -p 127.0.0.1:55432:5432 postgres:16-alpine
docker run -d --name lume-task0-<suffix>-redis \
  -p 127.0.0.1:56379:6379 redis:7-alpine
docker exec lume-task0-<suffix>-pg pg_isready -U e2e -d postgres
docker exec lume-task0-<suffix>-redis redis-cli ping

# 2) Pure preflight (safe with any infrastructure state).
E2E_DATABASE_URL='postgresql://e2e:e2e-local-only@127.0.0.1:55432/lume_e2e_task0?schema=public' \
E2E_REDIS_URL='redis://127.0.0.1:56379' \
pnpm --filter @lume/api exec tsx scripts/check-e2e-target.ts

# 3) Guard tests: no globalSetup, so no database is opened.
pnpm --filter @lume/api exec vitest run --config vitest.guard.config.ts

# 4) Build with the SAME origins the runner will use.
VITE_API_URL='http://127.0.0.1:33001' VITE_REALTIME_URL='http://127.0.0.1:33002' pnpm build

# 5) Run a smoke; Playwright recreates only the disposable E2E database.
E2E_DATABASE_URL='postgresql://e2e:e2e-local-only@127.0.0.1:55432/lume_e2e_task0?schema=public' \
E2E_REDIS_URL='redis://127.0.0.1:56379' \
E2E_API_PORT=33001 E2E_REALTIME_PORT=33002 \
E2E_WEB_PORT=35173 E2E_MOCK_PORT=33099 \
pnpm exec playwright test e2e/manifest-proxy.spec.ts --reporter=line --workers=1

# 6) Remove ONLY the containers created above.
docker rm -f lume-task0-<suffix>-pg lume-task0-<suffix>-redis
```

The credentials above are throwaway local-only fixtures. Never use values from
the developer `.env`, and never point the E2E variables at the existing
`lume-postgres-1` / `lume-redis-1` services.

### API integration suite (separate from Playwright)

Start a new local cluster, published on loopback with no shared volumes. The
`API_TEST_DATABASE_URL` must name an **absent** database matching
`lume_api_test_<suffix>` (lowercase letters, digits and underscore separators,
no `e2e` segment, 63 characters max). It must use an explicit alternate
Postgres port and may only include `?schema=public`. Do not use `DATABASE_URL`
or `E2E_DATABASE_URL` for this target. The role must be able to create a
database from `template0`; if the name already exists, setup fails before
migrating it. Use a fresh suffix for each run or recreate only your own
temporary container; there is no database-drop step.

```bash
docker run -d --name lume-api-test-local-pg \
  -e POSTGRES_USER=fixture -e POSTGRES_PASSWORD=fixture -e POSTGRES_DB=postgres \
  -p 127.0.0.1:55433:5432 postgres:16-alpine
docker run -d --name lume-api-test-local-redis \
  -p 127.0.0.1:56380:6379 redis:7-alpine
docker exec lume-api-test-local-pg pg_isready -U fixture -d postgres
docker exec lume-api-test-local-redis redis-cli ping

env -u PROFILE_PRIVACY_REDIS_URL -u LUME_INVITE_FIXTURE_DATABASE_URL -u LUME_INVITE_FIXTURE_REDIS_URL \
  API_TEST_DATABASE_URL="postgresql://fixture:fixture@127.0.0.1:55433/lume_api_test_$(date +%s)?schema=public" \
  API_TEST_REDIS_URL='redis://127.0.0.1:56380' \
  pnpm test

# Remove only the containers created for this run.
docker rm -f -v lume-api-test-local-pg lume-api-test-local-redis
```

`API_TEST_REDIS_URL` is used by the production-mode uploads fixture. With
dependencies already built, `pnpm --filter @lume/api test` runs just API
Vitest without Turbo building into the checkout. The normal API config
sets `PROFILE_PRIVACY_DATABASE_URL` to the validated API target for the
owner-maintained privacy fixture. `invite-cutover.test.ts` opts into a
separate populated Task 2 fixture; leave its variables unset for normal runs.

## CI wiring (`.github/workflows/ci.yml`)

- Two jobs, `needs: check` so their setups do not overlap.
- `check` keeps its original `5432:5432` Postgres for `pnpm db:migrate`, and
  gives API Vitest an independent `api-test-postgres` service on `55433:5432`
  via `API_TEST_DATABASE_URL`. `API_TEST_REDIS_URL` uses the check runner's
  temporary Redis service. Turbo forwards/hashes both API test variables and
  does not cache the stateful API test task.
- `e2e` gets its own runner VM and services published on `55432:5432` /
  `56379:6379`, plus `E2E_DATABASE_URL`, `E2E_REDIS_URL`, the four `E2E_*` ports
  and matching `VITE_*` build origins.
- **Networking caveat:** `runs-on: ubuntu-latest` jobs execute on the host, not
  inside a container. GitHub service DNS aliases (`postgres`, `redis`) are only
  resolvable from sibling containers, so all CI targets use published
  **localhost** ports. The E2E validator accepts `localhost` because it is a
  loopback host; it would reject a service alias such as `postgres:55432`.
   The workflow therefore uses plain `55432:5432` / `56379:6379` mappings; the
   explicit `127.0.0.1:host:container` form in the reproduction section applies
   to local `docker run` commands, not to GitHub Actions service mappings.

## Browser isolation evidence (local run, 2026-11-22)

Pure preflight:

```
E2E target preflight OK: database=127.0.0.1:55432/lume_e2e_task0 redis=127.0.0.1:56379
exit 0
```

Unsafe targets refused before any connection:

```
$ E2E_DATABASE_URL='postgresql://e2e:pw@db.internal:5432/lume_e2e_ci...' ... check-e2e-target.ts
exit 1
UnsafeTargetError: E2E_DATABASE_URL points at the occupied default Postgres port (5432) on db.internal. Provide an explicitly disposable local cluster on an alternate port.

$ E2E_DATABASE_URL='postgresql://e2e:pw@db.internal:55432/lume_e2e_ci...' ... check-e2e-target.ts
exit 1
UnsafeTargetError: E2E_DATABASE_URL must point at a local (loopback) disposable cluster, got db.internal
```

Guard tests (behavioral config/CLI, no source-text assertions):

```
Test Files  2 passed (2)
     Tests  19 passed (19)
```

Loopback binding check:

```
127.0.0.1:55432  127.0.0.1:56379
no 0.0.0.0 binding
```

Build-time origins in `apps/web/dist/assets/*.js`:

```
5 http://127.0.0.1:33001
1 http://127.0.0.1:33002
```

Migrated specs on alternate ports (runner log confirmed
`web=127.0.0.1:35173 api=127.0.0.1:33001 realtime=127.0.0.1:33002`):

```
pnpm exec playwright test e2e/manifest-proxy.spec.ts --reporter=line --workers=1
  2 passed (7.7s)

pnpm exec playwright test e2e/player-error.spec.ts --reporter=line --workers=1
  1 passed (7.2s)
```

After cleanup only `lume-postgres-1` (5432) and `lume-redis-1` (6379) remained,
with unchanged uptime; all alternate ports 33001/33002/35173/33099/55432/56379
were free. No production service or developer database was touched.

## Known caveats

- Eight other specs still use `process.env.API_URL ?? "http://127.0.0.1:3001"`.
  They are authoritative because `playwright.config.ts` injects the derived
  `API_URL` into test workers (verified in the v1 report). Migrating them to
  `e2e/helpers/config.ts` is optional follow-up, outside this review's scope.
- `check-build.mjs` compares source and `dist` mtimes; always `pnpm build`
  before E2E after changing `apps/*/src`.
