-- Isolated Vivero snapshots. No warehouse data or permissions are changed.
create table public.vivero_inventory_periods (
  id text primary key check (id ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  source_file text not null,
  source_sha256 text not null unique check (source_sha256 ~ '^[a-f0-9]{64}$'),
  source_manifest jsonb not null default '{}'::jsonb,
  first_counted_on date not null,
  last_counted_on date not null check (last_counted_on >= first_counted_on),
  expected_rows integer not null check (expected_rows > 0),
  expected_live bigint not null check (expected_live >= 0),
  expected_dead bigint not null check (expected_dead >= 0),
  published boolean not null default false,
  version integer not null default 1,
  updated_by uuid not null references public.vivero_members(user_id),
  updated_at timestamptz not null default now()
);

create table public.vivero_inventory_history (
  id text primary key,
  period_id text not null references public.vivero_inventory_periods(id),
  line_id text not null references public.vivero_lines(id),
  location_id text not null references public.vivero_locations(id),
  females integer not null check (females between 0 and 100000000),
  males integer not null check (males between 0 and 100000000),
  rootstocks integer not null check (rootstocks between 0 and 100000000),
  dead integer not null check (dead between 0 and 100000000),
  total integer generated always as (females + males + rootstocks) stored,
  counted_on date not null,
  responsible_name text not null,
  observations text not null default '',
  source_sheet text not null,
  source_row integer not null check (source_row > 0),
  source_cells jsonb not null,
  version integer not null default 1,
  updated_by uuid not null references public.vivero_members(user_id),
  updated_at timestamptz not null default now(),
  unique (period_id,line_id),
  unique (period_id,source_sheet,source_row)
);
create index vivero_inventory_history_line_idx on public.vivero_inventory_history(line_id,period_id desc);
create index vivero_inventory_history_location_idx on public.vivero_inventory_history(location_id);

do $$
declare t text;
begin
  foreach t in array array['vivero_inventory_periods','vivero_inventory_history'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select, insert on public.%I to authenticated',t);
    execute format('create index %I on public.%I(updated_by)',t||'_updated_by_idx',t);
    execute format('create policy vivero_history_read on public.%I for select to authenticated using (exists(select 1 from public.vivero_members where user_id=(select auth.uid()) and active))',t);
    execute format('create policy vivero_history_insert on public.%I for insert to authenticated with check (updated_by=(select auth.uid()) and exists(select 1 from public.vivero_members where user_id=(select auth.uid()) and active and role=''ADMINISTRADOR''))',t);
    execute format('create trigger vivero_stamp before insert or update on public.%I for each row execute function vivero_private.stamp_write()',t);
    execute format('create trigger vivero_audit after insert or update on public.%I for each row execute function vivero_private.audit_write()',t);
  end loop;
end;
$$;
-- Historical rows are append-only. Publication is validated before a period is visible.
grant update on public.vivero_inventory_periods to authenticated;
create policy vivero_period_publish on public.vivero_inventory_periods for update to authenticated
  using (exists(select 1 from public.vivero_members where user_id=(select auth.uid()) and active and role='ADMINISTRADOR'))
  with check (updated_by=(select auth.uid()) and exists(select 1 from public.vivero_members where user_id=(select auth.uid()) and active and role='ADMINISTRADOR'));

create function vivero_private.validate_inventory_period() returns trigger
language plpgsql security invoker set search_path='' as $$
declare actual_rows bigint; actual_live bigint; actual_dead bigint; first_day date; last_day date;
begin
  if tg_op='UPDATE' and old.published then
    raise exception 'El corte publicado es inmutable';
  end if;
  if new.published then
    select count(*),coalesce(sum(total),0),coalesce(sum(dead),0),min(counted_on),max(counted_on)
      into actual_rows,actual_live,actual_dead,first_day,last_day
      from public.vivero_inventory_history where period_id=new.id;
    if actual_rows<>new.expected_rows or actual_live<>new.expected_live or actual_dead<>new.expected_dead
      or first_day is distinct from new.first_counted_on or last_day is distinct from new.last_counted_on then
      raise exception 'El corte no coincide con los controles de importación';
    end if;
    if to_char(first_day,'YYYY-MM')<>new.id or to_char(last_day,'YYYY-MM')<>new.id then
      raise exception 'Las fechas no corresponden al período';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function vivero_private.validate_inventory_period() from public,anon,authenticated;
create trigger vivero_validate_period before insert or update on public.vivero_inventory_periods
  for each row execute function vivero_private.validate_inventory_period();

create function vivero_private.validate_inventory_history() returns trigger
language plpgsql security invoker set search_path='' as $$
declare is_published boolean;
begin
  -- Serializes insertion with publication so no late row can change a closed cut.
  select published into is_published from public.vivero_inventory_periods where id=new.period_id for update;
  if is_published is distinct from false then raise exception 'El corte no admite más filas'; end if;
  if to_char(new.counted_on,'YYYY-MM')<>new.period_id then raise exception 'Fecha fuera del corte'; end if;
  return new;
end;
$$;
revoke all on function vivero_private.validate_inventory_history() from public,anon,authenticated;
create trigger vivero_validate_history before insert on public.vivero_inventory_history
  for each row execute function vivero_private.validate_inventory_history();

-- Current display: latest complete snapshot, superseded only by a newer live count.
-- Missing lines are NOT carried forward from older snapshots or converted to zero.
create view public.vivero_inventory_effective with (security_invoker=true) as
with latest as (
  select id,source_file from public.vivero_inventory_periods where published order by id desc limit 1
), historical as (
  select h.*,p.source_file from public.vivero_inventory_history h join latest p on p.id=h.period_id
)
select i.id,i.females,i.males,i.rootstocks,i.dead,i.total,i.counted_on,i.responsible_name,
  i.version,i.updated_by,i.updated_at,'SUPABASE'::text as origin,
  null::text as source_period,null::text as source_file,null::text as source_sheet,null::integer as source_row,''::text as observations
from public.vivero_inventory i
where not exists(select 1 from historical h where h.line_id=i.id and h.counted_on>i.counted_on)
union all
select h.line_id,h.females,h.males,h.rootstocks,h.dead,h.total,h.counted_on,h.responsible_name,
  h.version,h.updated_by,h.updated_at,'HISTORICO'::text,h.period_id,h.source_file,h.source_sheet,h.source_row,h.observations
from historical h
where not exists(select 1 from public.vivero_inventory i where i.id=h.line_id and i.counted_on>=h.counted_on);
revoke all on public.vivero_inventory_effective from public,anon,authenticated;
grant select on public.vivero_inventory_effective to authenticated;
alter publication supabase_realtime add table public.vivero_inventory_periods;
notify pgrst,'reload schema';
