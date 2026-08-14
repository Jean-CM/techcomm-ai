create table if not exists public.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  conversation_id text,
  approval_result text not null check (approval_result in ('aprobado','rechazado','pendiente')),
  rejection_reason text,
  discount_requested boolean not null default false,
  requested_discount_amount numeric,
  customer_comments text,
  identity_confirmed boolean,
  quote_understood boolean,
  supervisor_required boolean not null default false,
  source text not null default 'elevenlabs',
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists approval_decisions_org_created_idx
  on public.approval_decisions(organization_id, created_at desc);
create index if not exists approval_decisions_order_idx
  on public.approval_decisions(work_order_id, created_at desc);

alter table public.approval_decisions enable row level security;

comment on table public.approval_decisions is 'Auditable decisions captured from approval calls or human channels.';
