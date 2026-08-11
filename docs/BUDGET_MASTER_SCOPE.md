# Techcomm Operations — Master Scope for Budget

Status: WORKING BASE FOR PARTNER ESTIMATE

This document exists so the commercial estimate does not omit implementation, infrastructure, integrations, security, support, or recurring operating costs.

## 1. Product / implementation scope

- Discovery and process alignment
- Final business-rule definition from partner documentation
- Techcomm Operations product UI system
- Dashboard and executive KPIs
- Conversations / customer interaction history
- Customers / customer 360
- Agenda and work orders
- Technician administration
- Authenticated technician portal
- Sales
- Quotes and customer approvals
- Heavy inventory / catalog
- Inventory movements and audit trail
- Inventory data-source integrations
- Call audit center
- Administration
- System health
- Notifications / reminders
- Training and operational documentation
- Acceptance testing / UAT

## 2. Inventory / ERP integration scope

- Excel / XLSX / CSV import
- SQL Server connector pattern
- PostgreSQL connector pattern
- MySQL connector pattern
- Oracle connector pattern
- REST API connector pattern
- SFTP / file-drop pattern
- SharePoint / OneDrive pattern
- Private-network agent
- HMAC-signed push integration
- Data mapping and normalization
- Incremental synchronization / watermark
- Sync audit history
- Error handling and retries
- SKU / barcode / model / supplier mapping
- Stock physical / reserved / pending / available
- Min/max/reorder thresholds
- Warehouses / locations (future production phase)
- Serial / IMEI tracking (future production phase)
- Lot tracking (future production phase)
- Purchase orders / receiving (future production phase)
- Transfers / physical counts / adjustments (future production phase)

## 3. Voice / messaging / AI

- ElevenLabs voice agent
- Post-call webhooks
- Private call recordings
- Historical audio audit workflow
- WhatsApp Business integration through Meta / ElevenLabs
- Phone calls / telephony provider usage
- AI summaries / intents / assistance
- OpenAI or other model usage where applicable
- Human escalation flows

## 4. Security

- Supabase Auth
- Server-side authorization
- Real owner/admin checks for privileged audit functions
- Technician isolation
- RLS policies
- Server-only service credentials
- Secrets outside application tables
- HMAC SHA-256 integration signatures
- Timestamp / replay window protection
- HTTPS/TLS
- Request payload limits
- Input validation
- Private storage for recordings
- Signed temporary audio URLs
- Audit logs
- Automatic inactivity logout
- Password reset / first-login password change
- Security headers
- Dependency maintenance
- Backup / restore testing
- Future MFA / WAF / stricter CSP if required
- Data-retention policy — pending partner documentation
- Recording-retention policy — pending partner documentation

## 5. Hosting / infrastructure

### Cloud / production
- Vercel application hosting
- Supabase database/auth/storage
- Domain / DNS
- Cloudflare DNS / tunnel / security where applicable
- Backups
- Monitoring and logs

### Hybrid / self-hosting option
- Proxmox / Linux / Docker host
- Reverse proxy
- Cloudflare Tunnel
- UPS / power protection
- Storage / backup target
- Local monitoring
- Disaster recovery procedure

## 6. Third-party recurring services

Prices must be verified against current official plans before the commercial estimate is finalized.

- Vercel
- Supabase
- ElevenLabs
- Telephony / Twilio if used for calls
- Meta WhatsApp conversation/message fees where applicable
- OpenAI/API usage where applicable
- Domain registration
- Cloudflare paid services if selected
- Monitoring / observability paid tier if selected
- Backup storage
- Email/SMS provider if added

## 7. Delivery / professional services

- Architecture and implementation
- UI/UX and product design
- Database design/migrations
- Integration engineering
- Security hardening
- Inventory/ERP mapping
- Deployment
- Testing
- UAT support
- Documentation
- Training
- Go-live support
- Post-launch stabilization
- Ongoing maintenance/support

## 8. Budget structure to present

The final estimate should separate:

1. One-time implementation value
2. Optional modules / future phases
3. Monthly recurring platform costs
4. Usage-variable costs (calls, AI, WhatsApp, storage)
5. Support / maintenance options
6. Hardware / self-hosting option, if requested
7. Contingency / integration complexity allowance

## 9. Partner documentation still required before final lock

- Official tariffs and conditions
- Warranty policy
- Installation / transport policy
- Returns / refunds
- Holiday / exceptional service hours
- Discount authority levels
- Recording and data retention
- Human escalation rules
- Required legal/regulatory wording
- ERP/inventory system details: engine, network, table/view/API, field mapping and expected volume
- Production user count / role count
- Expected monthly call volume
- Expected WhatsApp volume
- Expected inventory SKU and movement volume
- Backup / retention expectations
- SLA / support expectations

## 10. Commercial rule

Do not quote a single combined number without separating implementation from recurring and variable operating costs. Any amount based on third-party pricing must be re-verified immediately before the proposal is delivered.
