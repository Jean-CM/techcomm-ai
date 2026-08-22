# NEO Infrastructure Audit — 2026-08-22

Read-only PHASE 0 discovery of the JMAR / NEO ecosystem. **No infrastructure was modified.**

| File | What it is |
|---|---|
| [`NEO-INFRA-CONTEXT.md`](NEO-INFRA-CONTEXT.md) | **Start here.** Portable context for any AI agent resuming this work |
| [`DISCOVERY-REPORT.md`](DISCOVERY-REPORT.md) | Full findings, evidence, verification ledger, status dashboard |
| [`REMEDIATION-PLAN.md`](REMEDIATION-PLAN.md) | Phased fixes with change/impact/rollback/test per item |
| [`inventory/`](inventory/) | Machine-readable source of truth (hosts, services, domains, databases, repositories) |

## Headline findings

- 🔴 **Grafana has no admin password set** — defaults to `admin`, reachable across the LAN
- 🔴 **Zero backups exist** for 3 Postgres databases, MinIO, n8n, Grafana or Home Assistant
- 🔴 **`N8N_ENCRYPTION_KEY` has no durable copy** — its loss is unrecoverable
- 🟠 **`neo-executor` accepts container commands from GitHub issues without checking the author**
- 🟠 **NEO-Core's database schema is deployed nowhere** that could be found

## Corrections to the assumed architecture

**Proxmox, Cloudflare Tunnel, and Hermes could not be found.** The ecosystem is a single Docker
host (`dockerhost`, `10.0.0.59`) reached over Tailscale, deployed from `Jean-CM/neo-core-ai` by a
self-hosted GitHub Actions runner. See the verification ledger in the discovery report.

> **Note on location:** this audit covers the NEO ecosystem, which lives in `Jean-CM/neo-core-ai`.
> It was written here only because this session had push access to `techcomm-ai` alone. It is
> self-contained under `docs/neo-infra-audit/` and touches no product code. Its correct long-term
> home is `neo-core-ai` or a dedicated `jmar-infrastructure` repo.
