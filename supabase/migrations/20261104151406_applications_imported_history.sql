-- Read-only original application history, isolated from mobile authors and Almacen.
create table public.vivero_applications_history (
 id text primary key,
 record_date date not null,
 payload jsonb not null check (payload->>'id'=id and payload->>'date'=record_date::text and jsonb_typeof(payload->'product')='string'),
 source_file text not null,
 source_sheet text not null,
 source_row integer not null check (source_row>0),
 source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
 source_cells jsonb not null,
 published boolean not null default false,
 imported_at timestamptz not null default now(),
 unique(source_sha256,source_sheet,source_row)
);
create index vivero_applications_history_date on public.vivero_applications_history(record_date,id) where published;
alter table public.vivero_applications_history enable row level security;
revoke all on public.vivero_applications_history from anon,authenticated;
grant select on public.vivero_applications_history to authenticated;
create policy applications_history_members on public.vivero_applications_history for select to authenticated using (
 published and exists(select 1 from public.vivero_members m where m.user_id=(select auth.uid()) and m.active)
);
