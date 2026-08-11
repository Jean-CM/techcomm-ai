-- Techcomm Operations — quotation workflow hardening
-- Keeps the database constraint aligned with the statuses used by the CRM.

alter table public.quotes drop constraint if exists quotes_status_check;

alter table public.quotes
  add constraint quotes_status_check
  check (status = any (array[
    'draft'::text,
    'pending_approval'::text,
    'sent'::text,
    'accepted'::text,
    'review_requested'::text,
    'rejected'::text,
    'cancelled'::text,
    'expired'::text
  ]));

create or replace function public.get_quote_summary(p_organization_id uuid)
returns table (
  total bigint,
  draft bigint,
  pending_approval bigint,
  sent bigint,
  accepted bigint,
  rejected bigint,
  review_requested bigint,
  cancelled bigint,
  expired bigint,
  active_value numeric,
  accepted_value numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    count(*) filter (where q.status = 'draft')::bigint,
    count(*) filter (where q.status = 'pending_approval')::bigint,
    count(*) filter (where q.status = 'sent')::bigint,
    count(*) filter (where q.status = 'accepted')::bigint,
    count(*) filter (where q.status = 'rejected')::bigint,
    count(*) filter (where q.status = 'review_requested')::bigint,
    count(*) filter (where q.status = 'cancelled')::bigint,
    count(*) filter (
      where q.status = 'expired'
         or (
           q.expires_at is not null
           and q.expires_at <= now()
           and q.status not in ('accepted','rejected','cancelled')
         )
    )::bigint,
    coalesce(sum(q.total) filter (
      where q.status not in ('accepted','rejected','cancelled','expired')
        and (q.expires_at is null or q.expires_at > now())
    ), 0)::numeric,
    coalesce(sum(q.total) filter (where q.status = 'accepted'), 0)::numeric
  from public.quotes q
  where q.organization_id = p_organization_id;
$$;

revoke all on function public.get_quote_summary(uuid) from public;
grant execute on function public.get_quote_summary(uuid) to service_role;

comment on table public.products is
  'Canonical Techcomm Operations inventory catalog. The CRM calls this module Inventario; the physical table name remains products for compatibility with existing APIs, foreign keys and integrations.';
