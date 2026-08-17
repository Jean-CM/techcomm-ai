create extension if not exists pgcrypto;

create table if not exists public.cc_distributors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  external_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.cc_stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  distributor_id uuid references public.cc_distributors(id) on delete set null,
  name text not null,
  external_id text,
  province text,
  municipality text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cc_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_id text,
  full_name text not null,
  phone text not null,
  email text,
  address text,
  province text,
  municipality text,
  sector text,
  reference_1 text,
  reference_2 text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cc_customers_org_phone_idx on public.cc_customers(organization_id, phone);

create table if not exists public.cc_purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  distributor_id uuid references public.cc_distributors(id) on delete set null,
  store_id uuid references public.cc_stores(id) on delete set null,
  customer_id uuid not null references public.cc_customers(id) on delete restrict,
  external_id text,
  invoice_number text,
  product_name text not null,
  brand text,
  model text,
  serial_number text,
  installation_included boolean not null default false,
  purchased_at timestamptz,
  received_at timestamptz not null default now(),
  state text not null default 'received' check (state in ('received','validated','contact_pending','contacted','converted','closed','cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cc_purchases_org_state_idx on public.cc_purchases(organization_id, state, received_at desc);

create table if not exists public.cc_installation_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_id uuid not null references public.cc_purchases(id) on delete restrict,
  customer_id uuid not null references public.cc_customers(id) on delete restrict,
  state text not null default 'created' check (state in ('created','contact_pending','accepted','location_pending','scheduling','scheduled','in_progress','completed','declined','cancelled','escalated')),
  acceptance_status text not null default 'pending' check (acceptance_status in ('pending','accepted','declined')),
  requested_window text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_id)
);
create index if not exists cc_install_requests_org_state_idx on public.cc_installation_requests(organization_id, state, created_at desc);

create table if not exists public.cc_technicians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_id text,
  full_name text not null,
  phone text,
  zones text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cc_appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  installation_request_id uuid not null references public.cc_installation_requests(id) on delete cascade,
  technician_id uuid references public.cc_technicians(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  state text not null default 'proposed' check (state in ('proposed','confirmed','rescheduled','en_route','arrived','completed','cancelled','no_show')),
  source text not null default 'ai',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cc_appointments_org_start_idx on public.cc_appointments(organization_id, starts_at);

create table if not exists public.cc_interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  installation_request_id uuid references public.cc_installation_requests(id) on delete set null,
  customer_id uuid references public.cc_customers(id) on delete set null,
  channel text not null check (channel in ('voice','whatsapp','web','email','system')),
  direction text not null default 'outbound' check (direction in ('inbound','outbound','internal')),
  state text not null default 'initiated' check (state in ('initiated','connected','completed','failed','no_answer','escalated')),
  conversation_id text,
  provider_call_id text,
  intent text,
  outcome text,
  summary text,
  transcript jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cc_interactions_request_idx on public.cc_interactions(installation_request_id, started_at desc);

create table if not exists public.cc_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  aggregate_type text not null check (aggregate_type in ('purchase','installation_request','appointment','interaction','customer','system')),
  aggregate_id uuid,
  event_type text not null,
  from_state text,
  to_state text,
  correlation_id text not null,
  actor_type text not null default 'system' check (actor_type in ('system','agent','human','integration')),
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cc_events_correlation_idx on public.cc_events(correlation_id, created_at);
create index if not exists cc_events_aggregate_idx on public.cc_events(aggregate_type, aggregate_id, created_at);

create table if not exists public.cc_tool_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tool_name text not null,
  correlation_id text not null,
  idempotency_key text,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb,
  success boolean not null default false,
  error_code text,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create unique index if not exists cc_tool_audit_idempotency_idx on public.cc_tool_audit(organization_id, tool_name, idempotency_key) where idempotency_key is not null;

create table if not exists public.cc_integration_refs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  local_entity_type text not null,
  local_entity_id uuid not null,
  external_system text not null,
  external_id text not null,
  sync_status text not null default 'sandbox' check (sync_status in ('sandbox','pending','synced','error')),
  last_sync_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, local_entity_type, local_entity_id, external_system)
);

alter table public.cc_distributors enable row level security;
alter table public.cc_stores enable row level security;
alter table public.cc_customers enable row level security;
alter table public.cc_purchases enable row level security;
alter table public.cc_installation_requests enable row level security;
alter table public.cc_technicians enable row level security;
alter table public.cc_appointments enable row level security;
alter table public.cc_interactions enable row level security;
alter table public.cc_events enable row level security;
alter table public.cc_tool_audit enable row level security;
alter table public.cc_integration_refs enable row level security;