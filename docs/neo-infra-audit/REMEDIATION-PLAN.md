# JMAR MASTER REMEDIATION PLAN

Derived from `DISCOVERY-REPORT.md` (2026-08-22). Nothing here has been executed.

Every item is classified per your rule set:
- **SAFE_AUTO_FIX** — reversible, no data impact, testable, clear rollback
- **REQUIRES_APPROVAL** — touches production config, secrets, or networking
- **DESTRUCTIVE_OR_HIGH_RISK** — needs explicit authorization

---

## PHASE 1 — CRITICAL FIXES (P0)

### 1.1 Grafana default admin credential  🔴 CRITICAL
```
CHANGE:   Add GF_SECURITY_ADMIN_PASSWORD (from GHA secret) to platform.yml grafana service.
          Rebind ports 3000:3000 -> 127.0.0.1:3000.
WHY:      Password is currently unset -> Grafana default `admin` for user `jmaradmin`,
          reachable from every device on 10.0.0.0/24. Grafana holds datasource credentials.
IMPACT:   Grafana restarts (~10s). Existing dashboards//datasources persist in grafana_data.
          After rebinding, access moves to Tailscale or an SSH tunnel.
BACKUP:   Snapshot grafana_data volume before change.
ROLLBACK: Revert the compose block, re-run deploy-homelab workflow.
TEST:     Confirm login fails with old default; confirm new credential works; confirm
          port 3000 no longer answers from another LAN host.
```
**Classification: REQUIRES_APPROVAL** (production config + secret creation)
`SECRET_ROTATION_REQUIRED = true`

### 1.2 Backups — nothing is backed up  🔴 CRITICAL
No `pg_dump`, `restic`, `borg`, or snapshot automation exists anywhere.
At risk: `postgres_data`, `neo_studio_db_data`, `neo_minio_data`, `n8n_data`, `grafana_data`, `homeassistant_data`, `neo_viral_data`.

```
CHANGE:   Add a backup service/timer: nightly pg_dump of both Postgres DBs + mc mirror of
          MinIO + tar of n8n_data, written off-host, retained 14 days.
WHY:      Recovery objective (rule 78) is currently unmeetable. A disk failure loses everything.
IMPACT:   Additive only. Brief nightly IO load.
ROLLBACK: Remove the service; no existing component is modified.
TEST:     Run one restore into a scratch database and diff row counts. Rule 23 requires
          restore be proven, not assumed.
```
**Classification: SAFE_AUTO_FIX** (purely additive) — but the **restore test REQUIRES_APPROVAL**.

### 1.3 Preserve `N8N_ENCRYPTION_KEY`  🔴 CRITICAL
`infra/README.md` states it must be kept permanently. It exists only as a GitHub Actions secret.
If that secret is lost or rotated, **every credential stored in n8n becomes unrecoverable**.
```
ACTION:   Export the key to durable secret storage (password manager / offline copy).
          Document its existence in recovery runbook WITHOUT recording the value.
```
**Classification: REQUIRES_APPROVAL** (human handling of a secret; never place it in a repo)

---

## PHASE 2 — INFRASTRUCTURE STABILIZATION (P1)

### 2.1 neo-executor authorization gap  🟠 HIGH
```
CHANGE:   In apps/neo-executor/app.py poll_once(), before run_task():
            - reject unless issue["user"]["login"] is in an owner allowlist, AND
            - reject unless issue["author_association"] == "OWNER"
          Comment + close rejected issues with an explicit denial message.
WHY:      Any principal able to open an issue can stop containers and read logs.
IMPACT:   Legitimate owner-authored tasks unaffected.
ROLLBACK: Revert the commit; executor redeploys.
TEST:     Open a task issue as owner -> executes. Simulate non-owner login -> denied + logged.
```
**Classification: REQUIRES_APPROVAL** (changes a production control plane)

### 2.2 Move `homepage` off the raw Docker socket  🟡
It mounts `/var/run/docker.sock:ro` directly while a hardened `POST:0` socket-proxy already exists.
```
CHANGE:   Point homepage's docker provider at the warden socket-proxy; drop the bind mount.
ROLLBACK: Restore the volume line.
TEST:     Homepage container widgets still render.
```
**Classification: SAFE_AUTO_FIX**

### 2.3 Replace weak committed default secret  🟡
`NEO_TELEGRAM_WEBHOOK_SECRET: ${NEO_TELEGRAM_WEBHOOK_SECRET:-neo-ultron}` → remove the fallback so the service fails loudly instead of running with a guessable secret.
**Classification: REQUIRES_APPROVAL** (may interrupt Telegram webhook until the secret is set)

### 2.4 Reduce LAN exposure  🟡
Rebind to `127.0.0.1` and reach over Tailscale: Grafana `3000`, Prometheus `9090`, n8n `5678`, neo-executor `8788`.
Follows your rule 14. Note `n8n.jmar.do` ingress must be re-established first — **do not rebind n8n until the ingress path (§3.1) is understood**, or you will break it.
**Classification: REQUIRES_APPROVAL**

---

## PHASE 3 — RESOLVE THE UNKNOWNS (P1, investigation only)

These are **read-only investigations**, not changes. They gate later phases.

| # | Question | Why it blocks | Needs |
|---|---|---|---|
| 3.1 | How does `neo.jmar.do` / `n8n.jmar.do` reach `10.0.0.59`? | No cloudflared exists; Funnel is off. Until known, any rebinding risks an outage. | Cloudflare API read |
| 3.2 | Does Proxmox / `jmarlab` still exist? | Dashboard advertises `lab.jmar.do`; probe found nothing. | LAN access |
| 3.3 | Was the NEO Supabase project deleted, or never created? | NEO-Core has no database backend. | Supabase account history |
| 3.4 | Is Hermes genuinely retired? | Confirmed absent; needs your sign-off to delete from the model. | Your confirmation |
| 3.5 | Is the ISP router forwarding any port to the internet? | Determines whether §4 exposure is LAN-only or internet-facing. | Router admin (read-only) |

**Do not act on 3.2 by deleting anything** — classified `UNKNOWN_COMPONENT` per rule 67.

---

## PHASE 4 — DOCKER STANDARDIZATION (P2)

### 4.1 Pin all floating image tags
11 of 15 image refs float (`:latest` ×9, `:stable` ×1). Violates rule 6.
```
Pin: homepage, n8n, prometheus, node-exporter, grafana, minio, mc,
     docker-socket-proxy (×2), home-assistant
Method: resolve current running digest FIRST (needs homelab access), pin to that exact
        version so pinning changes nothing at runtime, then upgrade deliberately.
```
**Classification: REQUIRES_APPROVAL** — pinning to a *newer* tag than what is running is an
uncontrolled upgrade. Pin to the **currently running** version only.

### 4.2 Add healthchecks
18 of 21 containers have none, so `restart: unless-stopped` cannot detect a hung process.
Add per-service checks **verified against each real endpoint** (rule 21 — do not copy a template blindly).
**Classification: SAFE_AUTO_FIX** once each endpoint is confirmed.

### 4.3 Reconcile the homepage dashboard
Remove or actually deploy the 5 phantom services (Portainer, Uptime Kuma, Dozzle, Speedtest Tracker, Proxmox).
**Classification: SAFE_AUTO_FIX** (dashboard links only)

---

## PHASE 5 — NEO-CORE CONSOLIDATION (P2)
- Resolve the orphaned `database/supabase/schema.sql` (§3.3) — provision a NEO project or retire the schema.
- Fix `studio.jmar.do` / `media.jmar.do` NXDOMAIN, or remove the references.
- Decide NEO Studio's ingress: enable Tailscale Funnel, or front it with Cloudflare.

## PHASE 6 — BACKUP / RECOVERY (P2)
- Apply 3-2-1 to the Postgres dumps and MinIO bucket.
- Write `docs/DISASTER-RECOVERY.md` with a **tested** rebuild path for `dockerhost`.
- Add backup-failure alerting to Prometheus.

## PHASE 7 — OBSERVABILITY COMPLETION (P2)
Prometheus + Grafana + cAdvisor + node-exporter + Warden already exist — a solid base.
Missing: alerting rules (disk >80%, RAM >85%, backup failure, cert expiry), and log centralization (rule 20).
**Recommendation: Uptime Kuma + Alertmanager. Do NOT add Loki/Promtail yet** — rule 64: the stack does not yet justify it.

## PHASE 8 — GITOPS (P3)
IaC already lives in `neo-core-ai/infra/` and deploys via Actions — you are ~80% there.
**Recommendation: do NOT split out a `jmar-infrastructure` repo yet.** It would separate IaC from the
apps it builds (`build: context: ../../apps/...`), breaking the compose builds. Revisit only if
non-NEO workloads appear.

## PHASE 9 — NEO CONTROL PLANE (P4)
NEO-WARDEN already implements Phase 1 (observe) correctly, with `automatic_restarts: false`.
Progression should be: Warden (observe) → alerting (Phase 2) → executor with author allowlist +
audit log (Phase 3). **Do not grant autonomous remediation until 2.1 and the audit log exist.**

---

## ARCHITECTURAL PUSHBACK (rule 84)

Three points where I disagree with the master prompt's assumptions:

1. **The target architecture is built on Proxmox. Proxmox could not be found.** The real
   substrate is one Docker host. Adopting the Proxmox-shaped design would add a hypervisor
   layer you may not have. **Recommendation: design for `dockerhost` as it exists.**

2. **Cloudflare Tunnel is assumed; Tailscale is what's actually deployed and working.**
   Adding Cloudflare Tunnel alongside a functioning Tailscale mesh means two ingress paths,
   two failure modes, two access models. **Recommendation: standardize on Tailscale for
   admin access, and use Cloudflare only for genuinely public services.**

3. **Single point of failure.** Every homelab service, all three databases, MinIO, the runner
   and the executor live on one host with **no backups**. Before any new capability
   (Command Center, NEO-ULTRON autonomy), fix Phase 1. A control plane over an unrecoverable
   substrate increases blast radius rather than reducing it.
