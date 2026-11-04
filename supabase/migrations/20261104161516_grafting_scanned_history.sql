-- Private, read-only historical scans. No warehouse tables are modified.
create table public.vivero_grafting_history (
 id text primary key,
 record_date date,
 form_type text not null check(form_type in ('PV_F008_INJERTACION','PV_F007_YEMAS')),
 payload jsonb not null check(payload->>'id'=id and payload->>'formType'=form_type
   and coalesce(payload->>'date','')=coalesce(record_date::text,'')
   and jsonb_typeof(payload->'samples')='array' and jsonb_typeof(payload->'yemaCollections')='array'),
 source_file text not null,
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 source_pages integer[] not null check(cardinality(source_pages)>0),
 source_values jsonb not null,
 published boolean not null default false,
 imported_at timestamptz not null default now(),
 unique(source_sha256,source_pages)
);
create index vivero_grafting_history_date on public.vivero_grafting_history(record_date,id) where published;
alter table public.vivero_grafting_history enable row level security;
revoke all on public.vivero_grafting_history from public,anon,authenticated;
grant select on public.vivero_grafting_history to authenticated;
create policy grafting_history_members on public.vivero_grafting_history for select to authenticated using (
 published and exists(select 1 from public.vivero_members m where m.user_id=(select auth.uid()) and m.active)
);
