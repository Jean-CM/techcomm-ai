# Techcomm Operations — Load testing with Artillery

This folder contains read-only load tests for Techcomm Operations. The production profile must never create quotes, send WhatsApp messages, modify inventory, reschedule appointments, or execute any other write action.

## What this test covers

- CRM overview
- inventory pagination
- inventory deep-page browsing
- inventory search
- low/out-of-stock filters
- quotation listing
- health endpoint

The script intentionally avoids POST/PATCH/DELETE requests.

## Prerequisites

- Node.js 22+
- A valid Techcomm test user/session
- Artillery 2.x (`npx artillery@latest` is enough)

## Recommended environments

1. Run the full load profile against staging/homelab first.
2. Only run the read-only production profile during an agreed testing window.
3. Do not use the browser's administrator session cookie in shared logs, screenshots, Git commits, or chat messages.

## PowerShell — safe read-only run

Set the target and a short-lived authenticated Cookie header in your local PowerShell session only:

```powershell
$Env:TECHCOMM_TARGET = "https://techcomm-ai.jmar.do"
$Env:TECHCOMM_COOKIE = "<COPY THE FULL COOKIE HEADER FROM AN AUTHORIZED TEST SESSION>"
npx artillery@latest run .\load-tests\artillery-readonly.yml --output .\load-tests\artillery-result.json
```

Do not save `TECHCOMM_COOKIE` in the repository.

To debug requests locally:

```powershell
$Env:DEBUG = "http:request,http:response"
npx artillery@latest run .\load-tests\artillery-readonly.yml
Remove-Item Env:DEBUG
```

After the run, remove the session value:

```powershell
Remove-Item Env:TECHCOMM_COOKIE
```

## Acceptance targets

Initial Techcomm Operations targets for the read-only API test:

- p95 HTTP response time < 1.2 s
- p99 HTTP response time < 2.5 s
- failed virtual-user ratio < 1%
- no unexpected 5xx responses
- no database connection exhaustion
- no Supabase/Vercel runtime error spike

These are initial engineering gates, not final SLA commitments. They should be tightened after baseline measurements on the selected production architecture.

## Load profile

The current profile performs:

- 60 s warm-up at 2 arrivals/s
- 180 s ramp from 5 to 20 arrivals/s
- 300 s sustained peak at 20 arrivals/s
- 90 s burst from 20 to 35 arrivals/s

Because each virtual user performs several requests and pauses, arrival rate is not the same as concurrent logged-in employees. Use this HTTP profile to test API/database capacity. For browser/Core Web Vitals testing, use a separate Artillery + Playwright profile with a much smaller browser concurrency because headless browsers are CPU intensive.

## 100-user validation plan

For the goal of 100+ concurrent CRM users:

1. Run this read-only HTTP profile and observe p95/p99/5xx.
2. Add 10-20 Playwright browser VUs to measure real UI/Core Web Vitals.
3. Create isolated staging test accounts before testing writes.
4. Run a staging-only mixed workflow test for customer lookup, inventory lookup, quote creation, appointment operations, and order updates.
5. Monitor Vercel runtime errors and Supabase database load during every run.
6. Increase traffic in steps rather than jumping directly to a destructive stress test.

## Important security rule

Never commit session cookies, refresh tokens, service-role keys, ElevenLabs keys, database passwords, HMAC secrets, or any production credential into these files.
