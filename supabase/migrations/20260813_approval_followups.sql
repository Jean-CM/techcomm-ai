create table if not exists public.approval_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  scheduled_for timestamptz not null,
  customer_comments text,
  supervisor_required boolean not null default false,
  source text not null default 'elevenlabs',
  conversation_id text,
  idempotency_key text not null,
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists approval_followups_idempotency_key_uq
  on public.approval_followups(idempotency_key);

create index if not exists approval_followups_work_order_idx
  on public.approval_followups(work_order_id, scheduled_for desc);

create index if not exists approval_followups_org_status_idx
  on public.approval_followups(organization_id, status, scheduled_for);

alter table public.approval_followups enable row level security;

comment on table public.approval_followups is
  'Follow-up commitments created by approval-call agents. Organization is resolved server-side from the work order; external agents must never supply organization_id.';
