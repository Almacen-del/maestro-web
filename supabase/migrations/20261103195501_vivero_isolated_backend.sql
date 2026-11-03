-- Vivero only. No warehouse tables, functions, profiles or auth accounts are changed.
create schema if not exists vivero_private;
revoke all on schema vivero_private from public, anon, authenticated;

create table public.vivero_members (
  user_id uuid primary key references auth.users(id),
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  role text not null check (role in ('ADMINISTRADOR','SUPERVISOR','AUXILIAR')),
  active boolean not null default true
);
alter table public.vivero_members enable row level security;
revoke all on public.vivero_members from public, anon, authenticated;
grant select on public.vivero_members to authenticated;
create policy vivero_own_membership on public.vivero_members for select to authenticated
  using (user_id = (select auth.uid()) and active);

create table public.vivero_locations (
  id text primary key check (length(id) between 1 and 160),
  parent_id text references public.vivero_locations(id),
  code text not null, display_name text not null,
  type text not null check (type in ('VIVERO','MODULO','GERMINADOR','JARDIN_CLONAL','CAMA')),
  sort_order integer not null default 0, active boolean not null default true,
  version integer not null default 1,
  updated_by uuid not null references public.vivero_members(user_id),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);
create index vivero_locations_parent_idx on public.vivero_locations(parent_id);

create table public.vivero_lines (
  id text primary key check (length(id) between 1 and 160),
  location_id text not null references public.vivero_locations(id),
  code text not null, display_name text not null,
  sort_order integer not null default 0, active boolean not null default true,
  version integer not null default 1,
  updated_by uuid not null references public.vivero_members(user_id),
  updated_at timestamptz not null default now(),
  unique (location_id, code)
);

create table public.vivero_inventory (
  id text primary key references public.vivero_lines(id),
  females integer not null check (females between 0 and 100000000),
  males integer not null check (males between 0 and 100000000),
  rootstocks integer not null check (rootstocks between 0 and 100000000),
  dead integer not null check (dead between 0 and 100000000),
  total integer generated always as (females + males + rootstocks) stored,
  counted_on date not null,
  responsible_name text not null default '',
  version integer not null default 1,
  updated_by uuid not null references public.vivero_members(user_id),
  updated_at timestamptz not null default now()
);

create table public.vivero_lots (
  id text primary key check (length(id) between 1 and 160),
  lot_type text not null check (lot_type in ('SIEMBRA','INJERTACION')),
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  active boolean not null default true,
  version integer not null default 1,
  updated_by uuid not null references public.vivero_members(user_id),
  updated_at timestamptz not null default now(),
  unique (lot_type, month)
);
create table public.vivero_lot_lines (
  id text primary key,
  lot_id text not null references public.vivero_lots(id),
  line_id text not null references public.vivero_lines(id),
  version integer not null default 1,
  updated_by uuid not null references public.vivero_members(user_id),
  updated_at timestamptz not null default now(),
  unique (lot_id,line_id)
);
create index vivero_lot_lines_line_idx on public.vivero_lot_lines(line_id);

-- The JSON payload preserves the different official form structures; identity,
-- dates, authorship and optimistic concurrency are enforced relationally.
create table public.vivero_documents (
  id text primary key check (length(id) between 1 and 160),
  kind text not null check (kind in ('DAILY','MONITORING','APPLICATIONS','GRAFTING')),
  record_date date not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 250000),
  created_by uuid not null references public.vivero_members(user_id),
  created_at timestamptz not null default now(),
  version integer not null default 1,
  updated_by uuid not null references public.vivero_members(user_id),
  updated_at timestamptz not null default now(),
  check (payload ?& array['id','date'] and payload->>'id' = id and payload->>'date' = record_date::text),
  check (case kind
    when 'DAILY' then payload ?& array['title','start','end','location','collaborators','notes'] and jsonb_typeof(payload->'collaborators') = 'array'
    when 'MONITORING' then payload ?& array['responsible','groups'] and jsonb_typeof(payload->'groups') = 'array'
    when 'APPLICATIONS' then payload ?& array['product','location','applicationType','executor']
    when 'GRAFTING' then payload ?& array['responsible','formType','samples','yemaCollections'] and payload->>'formType' in ('PV_F008_INJERTACION','PV_F007_YEMAS') and jsonb_typeof(payload->'samples') = 'array' and jsonb_typeof(payload->'yemaCollections') = 'array'
    else false end)
);
create index vivero_documents_kind_date_idx on public.vivero_documents(kind,record_date desc,id);
create index vivero_documents_created_by_idx on public.vivero_documents(created_by);

create table public.vivero_audit (
  id bigint generated always as identity primary key,
  table_name text not null, record_id text not null,
  actor_id uuid not null references public.vivero_members(user_id),
  occurred_at timestamptz not null default now(),
  before_value jsonb, after_value jsonb not null
);
create index vivero_audit_record_idx on public.vivero_audit(table_name,record_id,occurred_at desc);
create index vivero_audit_actor_idx on public.vivero_audit(actor_id);
alter table public.vivero_audit enable row level security;
revoke all on public.vivero_audit from public, anon, authenticated;
grant select on public.vivero_audit to authenticated;
create policy vivero_audit_read on public.vivero_audit for select to authenticated
  using (exists (select 1 from public.vivero_members where user_id=(select auth.uid()) and active and role in ('ADMINISTRADOR','SUPERVISOR')));

create function vivero_private.stamp_write() returns trigger
language plpgsql security invoker set search_path='' as $$
declare member_name text;
begin
  select display_name into member_name from public.vivero_members where user_id=auth.uid() and active;
  if member_name is null then raise exception 'Cuenta sin acceso a Vivero' using errcode='42501'; end if;
  if tg_op='UPDATE' then
    if new.id is distinct from old.id then raise exception 'No se puede cambiar el identificador'; end if;
    if new.version <> old.version then raise exception 'El registro cambió. Actualiza antes de guardar.' using errcode='40001'; end if;
    new.version := old.version + 1;
  else
    new.version := 1;
  end if;
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  if tg_table_name='vivero_documents' then
    if tg_op='UPDATE' then
      if new.kind is distinct from old.kind then raise exception 'No se puede cambiar el tipo de documento'; end if;
      new.created_by := old.created_by; new.created_at := old.created_at;
      if new.kind='DAILY' then new.payload := new.payload || jsonb_build_object('recordedByName',old.payload->'recordedByName');
      elsif new.kind='APPLICATIONS' then new.payload := new.payload || jsonb_build_object('recordedBy',old.payload->'recordedBy');
      else new.payload := new.payload || jsonb_build_object('responsible',old.payload->'responsible'); end if;
    else
      new.created_by := auth.uid(); new.created_at := new.updated_at;
      -- The author comes from the authenticated membership, never from the phone.
      if new.kind='DAILY' then new.payload := new.payload || jsonb_build_object('recordedByName',member_name);
      elsif new.kind='APPLICATIONS' then new.payload := new.payload || jsonb_build_object('recordedBy',member_name);
      else new.payload := new.payload || jsonb_build_object('responsible',member_name); end if;
    end if;
  elsif tg_table_name='vivero_inventory' then
    new.responsible_name := member_name;
  end if;
  return new;
end;
$$;
revoke all on function vivero_private.stamp_write() from public, anon, authenticated;

-- Definer is limited to the trigger audit insert (not an exposed RPC).
create function vivero_private.audit_write() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.vivero_members where user_id=auth.uid() and active) then
    raise exception 'Cuenta sin acceso a Vivero' using errcode='42501';
  end if;
  insert into public.vivero_audit(table_name,record_id,actor_id,before_value,after_value)
    values(tg_table_name,new.id,auth.uid(),case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
  return new;
end;
$$;
revoke all on function vivero_private.audit_write() from public, anon, authenticated;

do $$
declare t text; writer text;
begin
  foreach t in array array['vivero_locations','vivero_lines','vivero_inventory','vivero_lots','vivero_lot_lines','vivero_documents'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select, insert, update on public.%I to authenticated',t);
    execute format('create index %I on public.%I(updated_by)',t||'_updated_by_idx',t);
    execute format('create policy vivero_read on public.%I for select to authenticated using (exists(select 1 from public.vivero_members where user_id=(select auth.uid()) and active))',t);
    writer := 'exists(select 1 from public.vivero_members where user_id=(select auth.uid()) and active';
    if t in ('vivero_locations','vivero_lines','vivero_lots','vivero_lot_lines') then
      writer := writer || ' and role in (''ADMINISTRADOR'',''SUPERVISOR'')';
    end if;
    writer := writer || ')';
    execute format('create policy vivero_insert on public.%I for insert to authenticated with check (%s and updated_by=(select auth.uid()))',t,writer);
    if t='vivero_documents' then
      writer := writer || ' and (created_by=(select auth.uid()) or exists(select 1 from public.vivero_members where user_id=(select auth.uid()) and role in (''ADMINISTRADOR'',''SUPERVISOR'')))';
    end if;
    execute format('create policy vivero_update on public.%I for update to authenticated using (%s) with check (%s and updated_by=(select auth.uid()))',t,writer,writer);
    execute format('create trigger vivero_stamp before insert or update on public.%I for each row execute function vivero_private.stamp_write()',t);
    execute format('create trigger vivero_audit after insert or update on public.%I for each row execute function vivero_private.audit_write()',t);
  end loop;
end;
$$;

-- Grant access only by inserting a Vivero membership for the existing administrator.
-- No auth account, password, warehouse profile or warehouse permission is changed.
insert into public.vivero_members(user_id,display_name,role)
select id,'Administrador','ADMINISTRADOR' from auth.users where lower(email)='almacen@arlessas.com';

-- New data only. No source Firebase history or demo records are copied.
alter publication supabase_realtime add table public.vivero_locations, public.vivero_lines,
  public.vivero_inventory, public.vivero_lots, public.vivero_lot_lines, public.vivero_documents;
notify pgrst, 'reload schema';
