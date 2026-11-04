-- Original Excel evidence is separate from mobile-authored documents.
create table public.vivero_monitoring_history (
 id text primary key,
 record_date date not null unique,
 payload jsonb not null check (payload->>'id'=id and payload->>'date'=record_date::text and jsonb_typeof(payload->'groups')='array'),
 source_file text not null,
 source_sheet text not null,
 source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
 source_cells jsonb not null,
 imported_at timestamptz not null default now(),
 unique(source_sha256,source_sheet)
);
alter table public.vivero_monitoring_history enable row level security;
revoke all on public.vivero_monitoring_history from anon,authenticated;
grant select on public.vivero_monitoring_history to authenticated;
create policy monitoring_history_members on public.vivero_monitoring_history for select to authenticated using (
 exists(select 1 from public.vivero_members m where m.user_id=(select auth.uid()) and m.active)
);
