create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  phone text not null unique,
  email text,
  address text,
  sector text,
  source text not null default 'whatsapp',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  channel text not null check (channel in ('whatsapp','web','phone','email')),
  external_id text,
  intent text,
  status text not null default 'open' check (status in ('open','waiting','resolved','escalated')),
  summary text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('customer','assistant','human','system')),
  content text not null,
  message_type text not null default 'text',
  external_message_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  category text,
  brand text,
  model text,
  price numeric(12,2),
  currency text not null default 'DOP',
  stock integer not null default 0,
  reserved_stock integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  specialties text[] not null default '{}',
  zones text[] not null default '{}',
  status text not null default 'available' check (status in ('available','busy','off','sick')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  technician_id uuid references public.technicians(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  address text not null,
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','rescheduled','cancelled','completed')),
  confirmation_status text not null default 'pending' check (confirmation_status in ('pending','confirmed','no_answer','reschedule_requested','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  technician_id uuid references public.technicians(id) on delete set null,
  equipment text,
  brand text,
  model text,
  issue text not null,
  status text not null default 'new' check (status in ('new','scheduled','in_route','diagnosis','quoted','approved','repairing','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','urgent')),
  source text not null default 'whatsapp',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired')),
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null default 1,
  unit_price numeric(12,2) not null default 0,
  status text not null default 'lead' check (status in ('lead','quoted','reserved','paid','delivered','cancelled')),
  source text not null default 'whatsapp',
  created_at timestamptz not null default now()
);

create table if not exists public.call_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','cancelled')),
  provider text not null default 'elevenlabs',
  external_conversation_id text,
  result text,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_conversations_customer on public.conversations(customer_id);
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at);
create index if not exists idx_appointments_starts_at on public.appointments(starts_at);
create index if not exists idx_work_orders_status on public.work_orders(status);
create index if not exists idx_call_reminders_due on public.call_reminders(status, scheduled_for);
