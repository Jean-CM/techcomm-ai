# Techcomm Operations — UI Redesign Final QA

Branch: `ui/techcomm-operations-v1-final`

## Visual system

- Techcomm Operations uses a scoped corporate dark theme (`.tcTheme`).
- Functional primary color: Techcomm blue/cyan.
- Corporate red is reserved for critical/destructive states and brand emphasis.
- Public/landing styling remains isolated from the Operations theme.
- Official Techcomm Wireless logo asset is included under `public/brand/` and used by the application shell.

## Application shell

- Collapsible desktop sidebar.
- Mobile slide-out navigation.
- Grouped navigation: General, Operación, Comercial, Control.
- Presentation profile selector remains available for partner demos.
- Audit/Admin visibility remains dependent on the real authenticated owner/admin membership passed from the server.

## Core views

- Dashboard uses compact KPI cards and action-oriented operational sections.
- Conversations preserve lightweight initial loading; transcript/details remain on demand.
- Customers, Agenda y Órdenes, Técnicos, Inventario, Ventas and Cotizaciones use the shared Product UI System.
- Tables share consistent status badges, filters, spacing and responsive behavior.

## Audit center

- Primary table no longer displays the long AI summary.
- Primary columns emphasize date, customer, phone, motive, order, duration, result, audio and detail.
- Detailed summary/transcript/analysis live in an on-demand detail drawer.
- Audio remains private and is requested only through the protected owner/admin endpoint when the user explicitly chooses to listen.
- Historical-audio recovery workflow remains available.

## Validation before merge

1. Verify desktop layout at 1440px and 1280px.
2. Verify sidebar collapsed and expanded states.
3. Verify mobile navigation and table overflow behavior.
4. Verify all presentation profiles.
5. Verify owner/admin can open Audit and non-admin cannot.
6. Verify Conversations does not preload transcript/audio.
7. Verify Audit audio playback requests a signed URL on demand.
8. Verify Dashboard KPIs reflect only real API data.
9. Run production build and review warnings.
10. Visually review Dashboard, Conversations, Agenda y Órdenes, Inventario and Auditoría before merging to `main`.

Do not merge this branch until the visual review is approved.
