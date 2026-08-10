# Techcomm Operations — Self-hosting / Partner Server Guide

Techcomm Operations is not tied to Vercel. The Next.js application can run on a Linux server or VM using Node.js 22 or Docker while continuing to use the existing hosted Supabase, ElevenLabs, Twilio and OpenAI integrations.

## Recommended migration model

For the first partner-server deployment, use a **hybrid architecture**:

- Techcomm Operations application: partner-owned Linux VM/server.
- Reverse proxy/TLS: Nginx, Caddy, Traefik or the partner's enterprise load balancer.
- Database/Auth/Storage: existing Supabase project.
- Voice/WhatsApp AI: existing ElevenLabs/Twilio integrations.
- OpenAI: existing server-side API integration.

This changes the application hosting location without migrating customer data or changing operational integrations. A fully self-hosted Supabase deployment can be evaluated separately because it adds database, auth, storage, backup and upgrade responsibilities.

## Minimum server requirements

Recommended starting point for a small production deployment:

- Linux x86_64 or ARM64 supported by Node 22 dependencies.
- 2 vCPU minimum; 4 vCPU recommended.
- 4 GB RAM minimum; 8 GB recommended.
- 20 GB+ SSD for OS, Docker images and logs.
- Docker Engine + Docker Compose plugin, or Node.js 22 if deploying without containers.
- Outbound HTTPS access to Supabase, ElevenLabs, OpenAI and any telephony/WhatsApp provider in use.
- Public HTTPS endpoint for provider webhooks.
- DNS record controlled by Techcomm or the partner.

Call audio is currently retained in Supabase Storage; the application container does not need persistent local storage for recordings.

## Required environment variables

Copy `.env.example` to a secure server-side file such as `.env.production` and populate values through the partner's secret manager when possible.

Never commit `.env.production` or send server-only values to the browser.

Critical variables include:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TECHCOMM_TOOL_SECRET`
- `CRON_SECRET`
- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`
- `ELEVENLABS_REMINDER_AGENT_ID`
- `ELEVENLABS_PHONE_NUMBER_ID`
- `ELEVENLABS_WHATSAPP_PHONE_NUMBER_ID`
- `ELEVENLABS_WEBHOOK_SECRET`
- `TWILIO_AUTH_TOKEN` when the Twilio webhook is enabled

## Docker deployment

Build with the public browser variables supplied as build arguments because `NEXT_PUBLIC_*` values are embedded in the browser bundle:

```bash
docker compose -f docker-compose.example.yml --env-file .env.production build
docker compose -f docker-compose.example.yml --env-file .env.production up -d
```

The example Compose file binds the application only to `127.0.0.1:3000`. The reverse proxy should be the only public entry point.

Validate:

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

Expected response:

```json
{"ok":true,"service":"techcomm-operations"}
```

## HTTPS and reverse proxy

Use `deploy/nginx.techcomm.conf.example` as a starting point. Replace `operations.example.com` and certificate paths.

Production requirements:

- Redirect HTTP to HTTPS.
- TLS 1.2/1.3 only.
- Do not expose port 3000 publicly.
- Preserve `Host`, `X-Forwarded-For` and `X-Forwarded-Proto`.
- Keep the application security headers enabled.
- Apply rate limiting carefully; do not challenge or block legitimate provider webhooks without allow-list/signature-aware rules.

## Webhooks after moving hosts

Any public callback URL must be changed to the new HTTPS hostname.

Review at minimum:

- ElevenLabs webhook URL.
- Twilio webhook URL if that channel is enabled.
- Public quote URLs.
- Technician public-token URLs.
- Password reset/callback URLs in Supabase Auth.
- `NEXT_PUBLIC_APP_URL`.

The ElevenLabs webhook is HMAC-verified, fail-closed and rejects stale signed requests. The Twilio webhook validates the Twilio signature.

## Scheduled reminder calls

Vercel currently schedules `/api/cron/process-reminders`. On a partner server, replace that scheduler with cron, systemd timers, Kubernetes CronJob or the partner's scheduler.

Example Linux cron every 5 minutes:

```cron
*/5 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://operations.example.com/api/cron/process-reminders >/dev/null
```

Prefer a wrapper script or secret-aware scheduler rather than putting the real secret directly into a world-readable crontab.

## Backups and recovery

The application itself is stateless. Protect the external state:

- Supabase PostgreSQL backups and tested restore procedure.
- Supabase Storage backup/retention for call recordings.
- Exported provider configuration for ElevenLabs/Twilio templates and agents where possible.
- Environment secrets backed up in the partner's approved secret manager.
- GitHub repository protected and preferably private before commercial rollout.

A backup is not considered complete until a restore test has succeeded.

## Production security checklist

Before exposing a new partner-server deployment:

1. Run `npm ci` from the committed lockfile.
2. Run `npm audit --audit-level=high` and require zero high/critical findings.
3. Run `npm run typecheck` and `npm run build`.
4. Confirm `/crm` and `/admin` redirect unauthenticated users to login.
5. Confirm protected APIs return `401` without credentials.
6. Confirm invalid ElevenLabs and Twilio signatures return `401`.
7. Confirm HSTS and browser security headers at the reverse proxy/application boundary.
8. Confirm port 3000 is not public.
9. Confirm firewall rules expose only required ports, normally 80/443 and restricted administration access.
10. Confirm backups, restore procedure, logging and alerting.
11. Run a passive OWASP ZAP baseline against the final hostname.
12. Run TLS and HTTP-header scans after DNS/TLS cutover.

## Server migration acceptance test

The migration is accepted only after these flows work end-to-end on the new hostname:

- Login and password recovery.
- CRM dashboard and all operational views.
- Product lookup.
- Repair/service-order creation.
- Appointment creation/reprogramming.
- Technician assignment/notification.
- Reminder call processing.
- ElevenLabs transcript webhook ingestion.
- Conversation and call-audio display.
- Quote public link and WhatsApp sending when enabled.
- Technician public-token workflow.
- Audit history.

Keep the Vercel production deployment available as a rollback target until the partner-server acceptance test is complete.
