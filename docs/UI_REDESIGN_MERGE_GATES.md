# Merge gates — Techcomm Operations UI redesign

Required before merging `ui/techcomm-operations-v1-final` into `main`:

- Vercel preview build is READY.
- Dashboard, Conversations, Customers, Agenda y Órdenes, Inventory and Audit reviewed visually.
- Sidebar expanded/collapsed states reviewed.
- Mobile navigation reviewed.
- Real owner/admin can access Audit; non-admin cannot.
- Audit audio is requested only on demand.
- Conversation transcript/audio remains lazy/on-demand.
- No backend/business-rule regression identified.
- Final external visual review (Gemini or equivalent) has no Critical findings.

Only after these gates pass should the branch be merged to production.
