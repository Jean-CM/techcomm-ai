create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  agent_id text,
  event_type text not null,
  status text,
  customer_phone text,
  order_id text,
  summary text,
  transcript jsonb not null default '[]'::jsonb,
  analysis jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (conversation_id, event_type)
);

alter table public.technicians drop constraint if exists technicians_status_check;
alter table public.technicians add constraint technicians_status_check check (status in ('available','busy','unavailable'));
update public.technicians set status = 'unavailable' where status in ('off','sick');

insert into public.products (sku, name, category, brand, model, price, currency, stock, reserved_stock, active)
values
  ('DEMO-MOB-SAM-001', 'Smartphone Samsung Galaxy', 'Móviles', 'Samsung', 'Modelo por confirmar', null, 'USD', 4, 0, true),
  ('DEMO-MOB-MOT-001', 'Smartphone Motorola', 'Móviles', 'Motorola', 'Modelo por confirmar', null, 'USD', 3, 0, true),
  ('DEMO-LAP-ACER-001', 'Laptop Acer', 'Computación', 'Acer', 'Modelo por confirmar', null, 'USD', 2, 0, true),
  ('DEMO-PART-LCD-001', 'Pantalla LCD de reemplazo', 'Piezas', null, 'Compatibilidad por confirmar', null, 'USD', 8, 1, true),
  ('DEMO-PART-BAT-001', 'Batería de reemplazo para móvil', 'Piezas', null, 'Compatibilidad por confirmar', null, 'USD', 12, 2, true),
  ('DEMO-ACC-USB-001', 'Cargador USB-C', 'Accesorios', null, 'Potencia por confirmar', null, 'USD', 15, 3, true)
on conflict (sku) do update set
  name = excluded.name,
  category = excluded.category,
  brand = excluded.brand,
  model = excluded.model,
  active = excluded.active;
