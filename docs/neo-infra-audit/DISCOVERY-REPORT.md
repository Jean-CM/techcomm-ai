# JMAR / NEO — DISCOVERY REPORT

**Phase:** PHASE 0 — READ-ONLY DISCOVERY
**Date:** 2026-08-22
**Mode:** READ-ONLY. No infrastructure, DNS, database, deployment or cloud resource was modified.
**Auditor session:** ephemeral Linux container (Claude Code remote), root, no homelab connectivity.

---

## 0. Access Bootstrap — what this session could actually reach

Verified by direct probe, not assumption.

| Plane | Status | Evidence |
|---|---|---|
| LOCAL FILESYSTEM | 🟢 AVAILABLE | `/home/user`, root privileges |
| GIT | 🟢 AVAILABLE | 2 repos on disk |
| GITHUB | 🟢 AUTHENTICATED | user `Jean-CM` (id 184700300), 16 repos enumerated |
| SUPABASE | 🟢 AUTHENTICATED | org `JMAR NEO`, 2 projects |
| VERCEL | 🟡 PARTIAL | team `jean-cm-s-projects` (pro). `list_projects` API fails; `get_project` works only by exact slug |
| SSH | 🔴 NOT AVAILABLE | no `ssh` binary, `~/.ssh` empty, no `known_hosts` |
| DOCKER | 🔴 NOT AVAILABLE | client v29.3.1 present, **no daemon**, no `/var/run/docker.sock` |
| PROXMOX | 🔴 NOT ACCESSIBLE | no `qm`/`pct`/`pvesh`, no network path |
| CLOUDFLARE | 🔴 NOT AUTHENTICATED | no `cloudflared`/`wrangler`, no API token |
| HOMELAB | 🔴 NO ACCESS | Tailscale/LAN unreachable from this container |
| DNS | 🟡 PARTIAL | resolution works; **HTTPS egress to `jmar.do` blocked by proxy policy** |

### ⚠️ Critical methodology note
All `https://*.jmar.do` probes returned HTTP `000`. This is **NOT an outage**.
The egress proxy answered `403` to `CONNECT` (`gateway answered 403 to CONNECT (policy denial)`).
A control test confirmed the distinction: `api.github.com` → `200`, `vercel.com` → `000`.

**Therefore no `jmar.do` service is reported as UP or DOWN in this audit. All are `UNVERIFIED — BLOCKED`.**

---

## 1. WHAT EXISTS

### 1.1 The homelab is NOT Proxmox-based (CONFIDENCE: HIGH)

The single most important correction to the assumed model.

Evidence — `neo-core-ai/ops/proxmox-probe.txt`, committed 2026-08-19:

```
host=dockerhost
ips=10.0.0.59 100.76.5.124 172.17.0.1 ...
route=default via 10.0.0.1 dev enp6s18
known_192_168_1_10_web=000
known_192_168_1_10_ssh=closed
ssh_root=unavailable
ssh_jmaradmin=unavailable
```

- The probe **ran on `dockerhost`, not on a Proxmox node**.
- The presumed Proxmox address `192.168.1.10` answered **web=000, ssh=closed, both SSH users unavailable**.
- The LAN is `10.0.0.0/24` (gw `10.0.0.1`), **not** `192.168.1.0/24`.

> **The node `jmarlab` was not found. No Proxmox node, VM or LXC could be verified anywhere.**
> The homelab that demonstrably exists is a **single Docker host** named `dockerhost` at `10.0.0.59`.
> Proxmox is either decommissioned, on a different subnet, or never existed as described.
> Classification: `UNKNOWN_COMPONENT` — **do not delete anything on this basis; investigate first.**

### 1.2 Access path is Tailscale, not Cloudflare Tunnel (CONFIDENCE: HIGH)

`ops/tailscale-probe.txt`:
```
tailscale_version=1.102.2   tailscale_ip=100.76.5.124
dns_name=dockerhost.tailda8389.ts.net.   backend_state=Running
```
`ops/tailscale-funnel.txt`:
```
exit_code=124
Funnel is not enabled on your tailnet.
No serve config
public_health_code=000
```

- Tailscale is **Running**; the mesh is the real remote-access path.
- **Tailscale Funnel is NOT enabled** on the tailnet, and there is **no serve config**.
- No `cloudflared` container, config, or tunnel credential exists anywhere in either repository.

> Cloudflare is used for **DNS/proxy only** (verified: `jmar.do` resolves to `104.21.47.11` / `172.67.169.175`, Cloudflare anycast).
> **No evidence of Cloudflare Tunnel or Zero Trust was found.** How `neo.jmar.do` reaches `10.0.0.59` is **UNRESOLVED**.

### 1.3 Repositories — 16 total, 2 relevant

`neo-core-ai` (private, most recently pushed 2026-08-19) is the true NEO monorepo:

```
apps/      neo-executor, neo-studio-analyst, neo-studio-api,
           neo-studio-gateway, neo-viral, web
infra/     compose/{platform,studio,executor}.yml, scripts/
database/  homelab/*.sql, supabase/schema.sql
ops/       proxmox-probe, tailscale-probe, tailscale-funnel, runner-heartbeat
```

Other JMAR-adjacent repos: `watcheagle-Web`, `watcheagle-waha`, `techcomm-ai-insights`, `payflow-control`, `renta-mapa-rd`, `web-agent`, `beatbrain-analytics`, `video-factory`, `Gestor_cuentas_SP`, `mi-gestor-cuentas`, `music-stats-app`, `jatune-studio-frontend`, `Tamo-harto-EDES-bot`.

**No `jmar-infrastructure` repo exists.** IaC currently lives inside `neo-core-ai/infra/`.

### 1.4 Deployment model — GitHub Actions self-hosted runner

9 workflows. Deployment is **not** manual SSH and **not** Vercel for the homelab:

| Workflow | Trigger | Runner |
|---|---|---|
| `deploy-homelab.yml` | push `main` (gated by `HOMELAB_PLATFORM_DEPLOY_ENABLED`) | self-hosted `jmar-docker` |
| `deploy-studio-homelab.yml` | push `main` | self-hosted `jmar-docker` |
| `bootstrap-studio-homelab.yml` | dispatch | self-hosted `jmar-docker` |
| `enable-studio-funnel.yml` | push `main` | self-hosted `jmar-docker` |
| `ensure-studio-funnel.yml` | cron `*/5 * * * *` | ubuntu-latest |
| `homelab-heartbeat.yml` | cron `*/15 * * * *` | self-hosted `jmar-docker` |
| `homelab-watchdog.yml` | cron `*/30 * * * *` | ubuntu-latest |
| `ci.yml`, `studio-ci.yml` | PR/push | ubuntu-latest |

A self-hosted runner labelled `jmar-docker` runs on `dockerhost` as user `jmaradmin`.

---

## 2. WHAT IS RUNNING

**Last positive signal:** `ops/runner-heartbeat.json`

```json
{ "checked_at": "2026-08-19T18:21:13Z", "host": "dockerhost",
  "runner": "jmar-docker", "studio_api_ok": true, "analyst_ok": true }
```

🟡 That heartbeat is **~3 days stale** relative to this audit (2026-08-22). The watchdog runs every 30 min but its result is not visible from here.
**Current live state of every homelab service: `UNVERIFIED — BLOCKED`.**

Declared stack (from IaC, 21 containers across 3 compose projects):

| Stack | Containers |
|---|---|
| `platform.yml` | homepage, neo-postgres, n8n, neo-redis, neo-traffic, homeassistant, neo-prometheus, neo-grafana, neo-node-exporter, neo-cadvisor, neo-warden-docker-proxy, neo-warden, neo-viral |
| `studio.yml` | neo-studio-db, neo-studio-migrate, neo-minio, neo-minio-init, neo-studio-api, neo-studio-gateway, neo-studio-analyst |
| `executor.yml` | neo-executor-docker-proxy, neo-executor |

**NEO-WARDEN** is a genuinely good piece of design: a read-only health aggregator with an explicit self-declared policy:
`{"mode":"observe-first","automatic_destructive_actions":false,"automatic_restarts":false}` — exactly the posture the target architecture calls for.

---

## 3. WHAT IS BROKEN / MISSING

### 🔴 HERMES DOES NOT EXIST
Exhaustive search across both repositories for `hermes|Hermes|HERMES` returned **exactly one file**: `apps/web/package-lock.json`, matching only:
```
hermes-estree, hermes-parser  (transitive Babel/React-Native npm packages)
```
No Hermes service, container, compose entry, domain, database, systemd unit, repo or env var exists.

> **Conclusion: "Hermes" is not a component of this ecosystem.** It is either a renamed/abandoned concept or belongs to a system outside these accounts. Every Hermes-related task in the master prompt is `NOT_APPLICABLE` until you confirm otherwise. **CONFIDENCE: HIGH.**

### 🔴 NEO-Core's Supabase backend is missing
- Supabase org `JMAR NEO` contains **only 2 projects**: `Techcomm Assistant` (ACTIVE_HEALTHY) and `CasaGO` (**INACTIVE/paused**).
- There is **no `neo-core-ai` and no `neo-core-prod` Supabase project**.
- There is **no `JMAR NEO RECOVERY` organization.**
- `neo-core-ai/database/supabase/schema.sql` defines: `projects, conversations, messages, agents, ai_requests, ai_responses, memory_items, design_variants, agent_runs, agent_run_results`.
- `Techcomm Assistant` contains **none** of `projects`, `agents`, `ai_requests`, `memory_items`, `design_variants`, `agent_run_results`.

> **The NEO-Core schema is deployed nowhere reachable.** The web app's persistence layer has no verified home. `CONFIGURATION_DRIFT`, severity HIGH.

### 🟠 Documented services that exist in no compose file
`infra/compose/homepage/services.yaml` advertises: **Proxmox** (`lab.jmar.do`), **Portainer** (`portainer.jmar.do`), **Uptime Kuma** (`uptime.jmar.do`), **Dozzle** (`logs.jmar.do`), **Speedtest Tracker** (`speedtest.jmar.do`), **Grafana** (`grafana.jmar.do`), **Home Assistant** (`home.jmar.do`).

Only Grafana and Home Assistant appear in IaC — and both are published on **different ports/paths** than the dashboard implies. The rest are either hand-deployed outside GitOps or dead links. `CONFIGURATION_DRIFT`.

### 🟠 Referenced domains that do not resolve
`studio.jmar.do` → NXDOMAIN (but is in `NEO_STUDIO_CORS_ORIGINS`)
`media.jmar.do` → NXDOMAIN (but is `MINIO_BROWSER_REDIRECT_URL`)
`studio-api.jmar.do` → referenced in `apps/web/.env.example` as `NEO_STUDIO_API_URL`

Combined with Funnel being disabled, **the entire NEO Studio public surface appears non-functional.**

---

## 4. WHAT IS EXPOSED

Port bindings as declared in IaC. `0.0.0.0` = reachable by **any device on the `10.0.0.0/24` LAN**.

| Port | Service | Bind | Assessment |
|---|---|---|---|
| 3000 | **Grafana** | `0.0.0.0` | 🔴 see §5.1 |
| 3005 | homepage | `0.0.0.0` | 🟡 mounts docker.sock |
| 5678 | **n8n** | `0.0.0.0` | 🟠 automation admin on LAN |
| 8123 | Home Assistant | host net | 🟠 `privileged: true` |
| 8685 | traffic-api | host net | 🟡 |
| 8787 | neo-warden | host net | 🟡 read-only by design |
| **8788** | **neo-executor** | `0.0.0.0` | 🟠 see §5.2 |
| 8790 | neo-viral | `0.0.0.0` | 🟠 holds social OAuth tokens |
| 9090 | Prometheus | `0.0.0.0` | 🟡 no auth by default |
| 18082 | cAdvisor | `0.0.0.0` | 🟡 `privileged: true` |
| 19100 | node-exporter | `0.0.0.0` | 🟡 |
| 2375 | warden docker-proxy | `127.0.0.1` | 🟢 correct |
| 8811 / 8821 / 8831 | studio api / analyst / gateway | `127.0.0.1` | 🟢 correct |
| 9000 / 9001 | MinIO | `127.0.0.1` | 🟢 correct |

**Good news:** nothing indicates ports are forwarded from the ISP router to the internet, and Funnel is off. Exposure is currently **LAN-scoped**, which materially lowers severity — but the LAN reportedly has dozens of WiFi devices and two ISP links.

---

## 5. SECURITY FINDINGS

### 5.1 🔴 CRITICAL — Grafana admin password never set
```yaml
grafana:
  environment:
    GF_SECURITY_ADMIN_USER: jmaradmin
    GF_USERS_ALLOW_SIGN_UP: "false"
  ports: ["3000:3000"]
```
`GF_SECURITY_ADMIN_PASSWORD` is **absent**. Grafana falls back to the default password `admin`.
Result: `jmaradmin` / `admin` on `http://10.0.0.59:3000`, reachable by every device on the LAN. Grafana holds datasource credentials and can query Prometheus.

- **IMPACT:** full dashboard takeover + datasource credential disclosure from any LAN device.
- **FIX:** set `GF_SECURITY_ADMIN_PASSWORD` from a GitHub Actions secret; bind to `127.0.0.1` and reach it via Tailscale.
- **RISK OF FIX:** low. **ROLLBACK:** revert compose block, redeploy.
- `SECRET_ROTATION_REQUIRED = true`

### 5.2 🟠 HIGH — neo-executor: GitHub issues are an unauthenticated command channel
`apps/neo-executor/app.py` polls open issues labelled `neo-exec` every 30s, parses the **issue body as JSON**, and executes it:
```python
task = json.loads((issue.get("body") or "").strip())
result = await run_task(task)
```
`run_task` supports `docker.start` / `docker.stop` / `docker.restart` / `docker.logs`, backed by a socket-proxy with **`POST: "1"`** (write-enabled).

**There is no check of the issue's author.** Any principal who can open an issue on the repo can stop containers and read logs.

- **Mitigating:** repo is private; container names are allowlisted (`NEO_EXECUTOR_ALLOWED_PREFIXES`); no `exec`/`create`/`remove` verbs.
- **IMPACT:** denial-of-service against the homelab + log disclosure, via GitHub rather than the network.
- **FIX:** verify `issue.user.login` against an owner allowlist **and** require the issue be author-associated `OWNER`, before `run_task`.
- **NOTE:** `neo-executor` also holds `NEO_GITHUB_TOKEN`; confirm it is a fine-grained token limited to `issues:write` on one repo.

### 5.3 🟠 HIGH — No backup strategy exists at all
Exhaustive search for `pg_dump|restic|borg|backup|snapshot` across all IaC, scripts and workflows found **one line**, and it is only policy prose (`NEO_INFRA_UPDATE_POLICY.md:34`).

Unprotected stateful volumes: `postgres_data` (n8n), `neo_studio_db_data`, `neo_minio_data`, `n8n_data`, `grafana_data`, `prometheus_data` (90d retention), `homeassistant_data`, `neo_viral_data`.

> **`N8N_ENCRYPTION_KEY` is documented as "keep permanently" — if it is lost, every stored n8n credential is unrecoverable.** There is no verified copy of it anywhere.
> **Nothing in this ecosystem has a tested restore path. Recovery objective (rule 78) is currently NOT MET.**

### 5.4 🟡 MEDIUM — Docker socket access
| Container | Access | Verdict |
|---|---|---|
| `homepage` | `/var/run/docker.sock:ro` direct | `SECURITY_EXCEPTION` — use the socket-proxy instead |
| `neo-warden-docker-proxy` | socket → `POST:0`, localhost | 🟢 correct pattern |
| `neo-executor-docker-proxy` | socket → **`POST:1`** | write-enabled; justified by function, see §5.2 |
| `cadvisor` | `privileged: true` + `/var/lib/docker:ro` | expected for cAdvisor |
| `homeassistant` | `privileged: true` + host net | expected for device access |

### 5.5 🟡 MEDIUM — Weak default secret in IaC
`platform.yml`: `NEO_TELEGRAM_WEBHOOK_SECRET: ${NEO_TELEGRAM_WEBHOOK_SECRET:-neo-ultron}`
A guessable literal fallback committed to the repo. If the env var is unset, the Telegram webhook is protected by the string `neo-ultron`.

### 5.6 🟢 Secret hygiene is GOOD
- Full-history scan of `techcomm-ai` (57 commits) — **no secrets found**.
- Working-tree scan of both repos (`sk-`, `ghp_`, `github_pat_`, JWT, `AKIA`, PEM keys) — **no secrets found**.
- No `.env` file is tracked in either repo; only `.env.example` templates.
- `.gitignore` correctly excludes `.env*`, `*.pem`, `*.key`, `secrets/`.
- `infra/README.md` explicitly forbids committing credentials.

> Note: `neo-core-ai` was cloned `--depth 1`, so its **full history was not scanned**. `PARTIALLY VERIFIED`.

### 5.7 Supabase — `Techcomm Assistant` (⚠️ OUT_OF_SCOPE for changes; reported only)
All 55 tables have **RLS enabled** — good baseline.
- 13 tables have **RLS enabled with zero policies** (`cc_*`, `approval_decisions`, `approval_followups`). This **fails closed** (no anon/authenticated access) — it is a *functionality* risk, not a data leak.
- 3 `SECURITY DEFINER` functions callable by `authenticated`: `get_quote_summary`, `is_biz_org_member`, `is_biz_org_writer` — **review intent**.
- `next_quote_number` has a mutable `search_path` (privilege-escalation vector).
- `vector` extension installed in `public`.
- **Leaked-password protection is disabled** in Auth.

### 5.8 🟡 Image pinning
11 of 15 image references use floating tags (`:latest` ×9, `:stable` ×1). Only `cadvisor:v0.53.0`, `postgres:16-alpine`, `redis:7-alpine`, `alpine:3.22`, `python:3.12-alpine` are pinned. Violates your rule 6; blocks reproducible rebuild and rollback.

### 5.9 🟡 Healthchecks
Only the 3 Postgres services define a `healthcheck`. n8n, Grafana, Prometheus, MinIO, viral, warden, executor, gateway, analyst have **none** — so `restart: unless-stopped` cannot detect a hung-but-alive process.

---

## 6. CLOUD

### Vercel — `jean-cm-s-projects` (pro)
Only one project was resolvable (`list_projects` is failing at the API level; slugs had to be guessed):

| Project | `techcomm-ai` |
|---|---|
| ID | `prj_1mO8ErsoT6yMlXhbbuUVNzBFMTyV` |
| Framework | Next.js, Node 22.x |
| Production | `dpl_EJWpV7W9rn5U7WVAs5QxKXiPat8T` — READY |
| Domains | `techcomm-ai.jmar.do`, `techcomm-ai-one.vercel.app`, +2 |

`casago.jmar.do` resolves to Vercel anycast (`216.150.1.129`) so a CasaGO project **does exist**, but was not enumerable. **No NEO Vercel project was found** — `neo`, `neo-core`, `neo-core-ai`, `web` all 404.

> `neo.jmar.do` is Cloudflare-proxied and `neo-core-ai/vercel.json` exists, yet no NEO Vercel project resolved. **Where `neo.jmar.do` terminates is UNRESOLVED.** `BLOCKED` — needs Cloudflare DNS access.

---

## 7. STATUS DASHBOARD

Percentages are stated only where a verifiable denominator exists.

```
JMAR LAB STATUS                     (2026-08-22, read-only)
Infrastructure        UNASSESSED   — no homelab connectivity
Docker                UNASSESSED   — no daemon reachable; 21 containers declared in IaC
Hermes                N/A          — component does not exist
NEO-Core              UNVERIFIED   — code present; database backend not found
Supabase              50%          — 1 of 2 projects ACTIVE_HEALTHY (CasaGO INACTIVE)
Vercel                PARTIAL      — 1 project verified READY; enumeration broken
Cloudflare            UNASSESSED   — not authenticated
Security              27%          — 4 of 15 images pinned; 1 critical, 2 high open
Backups               0%           — no backup mechanism exists anywhere
Monitoring            60%          — Prometheus+Grafana+cAdvisor+node-exporter+Warden
                                     deployed; 3 of 21 containers have healthchecks
Documentation         70%          — architecture/deployment docs exist; drift vs reality
GitOps                80%          — 9 workflows, IaC-driven, self-hosted runner

Critical Issues       1
High Issues           3
Medium Issues         5
Low Issues            4
```

---

## 8. VERIFICATION LEDGER

| Claim (from master prompt) | Verdict |
|---|---|
| Proxmox node `jmarlab` exists | 🔴 **NOT FOUND** — probe shows `dockerhost`; `192.168.1.10` closed |
| Cloudflare Tunnel in use | 🔴 **NO EVIDENCE** — no cloudflared anywhere; Tailscale instead |
| Hermes is a component | 🔴 **DISPROVEN** — npm package name only |
| Supabase `neo-core-prod` exists | 🔴 **NOT FOUND** |
| Supabase org `JMAR NEO RECOVERY` | 🔴 **NOT FOUND** — only `JMAR NEO` |
| Domain `jmar.do` | 🟢 **CONFIRMED** — Cloudflare-proxied |
| `casago.jmar.do` active | 🟢 **CONFIRMED** — resolves to Vercel |
| `lab.jmar.do` active | 🟡 resolves via Cloudflare; origin unverified |
| n8n in use | 🟢 **CONFIRMED** in IaC |
| WatchEagle exists | 🟢 **CONFIRMED** — 2 repos; not in NEO IaC |
| Docker is a main runtime | 🟢 **CONFIRMED** |
| NEO-Core-AI exists | 🟢 **CONFIRMED** — active monorepo |

---

## 9. NEXT SAFE ACTIONS

Ordered. Nothing below was executed.

**P0 — do first**
1. Set `GF_SECURITY_ADMIN_PASSWORD` from a GHA secret; rotate the Grafana admin credential (§5.1).
2. Establish backups: nightly `pg_dump` of all 3 Postgres DBs + MinIO + n8n volume, off-host, with **one tested restore** (§5.3).
3. Copy `N8N_ENCRYPTION_KEY` to durable secret storage — losing it is unrecoverable.

**P1**
4. Add an issue-author allowlist to `neo-executor` before `run_task` (§5.2).
5. Resolve where `neo.jmar.do` terminates — requires Cloudflare access.
6. Determine whether the NEO Supabase project was deleted or never created (§3).
7. Move `homepage` off the raw docker socket onto a `POST:0` proxy.

**P2**
8. Pin all floating image tags; record versions for rollback.
9. Add healthchecks to the 18 containers lacking them.
10. Reconcile `homepage/services.yaml` with reality; remove or deploy the 5 phantom services.
11. Bind Grafana/Prometheus/n8n to `127.0.0.1` and reach them over Tailscale.

**Blocked pending your input**
- Confirm whether Proxmox still exists anywhere → if not, correct `infra/README.md` and the homepage dashboard.
- Confirm Hermes is genuinely retired → then delete it from the ecosystem model.
- Grant Cloudflare API read access to complete the DNS→origin map.
