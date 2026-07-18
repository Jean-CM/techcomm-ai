# Techcomm Nexus AI Architecture

## Product boundary

Techcomm Nexus AI is an AI Operations Platform composed of three portals:

1. Customer Portal
2. Internal Operations Portal
3. Administration Portal

## High-level flow

External channels and portals
→ Next.js application
→ Node.js AI Orchestrator
→ Supabase PostgreSQL
→ n8n automations
→ Observability and analytics

## Important integration rule

External channels such as WhatsApp must never connect directly to Supabase.

Approved flow:

WhatsApp
→ Node.js backend
→ Supabase
→ Portal
→ Analytics

## Core agents

- Nexus Concierge
- Nexus Scheduler
- Nexus Case Manager
- Nexus Knowledge

## Security model

- Authentication through Supabase Auth
- Row Level Security on private tables
- Tenant isolation using organization_id
- Role-based access control
- Server-only privileged credentials
- Private storage buckets with signed URLs
- Audit trails for sensitive changes
- Separate development, preview and production environments

## Infrastructure

- GitHub: source control and pull requests
- Vercel: web deployment
- Supabase: database, authentication and storage
- Cloudflare: DNS, edge security and access controls
- Sentry: application errors
- Better Stack: logs and observability
- n8n: controlled workflow automation
