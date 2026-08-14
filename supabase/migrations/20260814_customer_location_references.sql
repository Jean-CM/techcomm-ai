alter table public.customers
  add column if not exists province text,
  add column if not exists municipality text,
  add column if not exists address_reference_1 text,
  add column if not exists address_reference_2 text,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists location_precision text,
  add column if not exists location_updated_at timestamptz;

comment on column public.customers.province is 'Provincia del cliente para planificación territorial y georreferencia.';
comment on column public.customers.municipality is 'Municipio o Distrito Nacional asociado a la dirección.';
comment on column public.customers.address_reference_1 is 'Primera referencia para facilitar la llegada del técnico.';
comment on column public.customers.address_reference_2 is 'Segunda referencia opcional para facilitar la llegada del técnico.';
comment on column public.customers.location_precision is 'Nivel de precisión de la ubicación: exact, address, sector, municipality o province.';
