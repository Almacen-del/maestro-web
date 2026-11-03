-- Transactional verification only: every inserted row and audit entry is rolled back.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','5799fac7-852e-4261-9717-015a2d287463',true);
do $$
declare failures integer := 0; v integer; t integer;
begin
  if (select count(*) from public.vivero_members) <> 1 then raise exception 'Missing administrator membership'; end if;
  insert into public.vivero_locations(id,code,display_name,type)
    values('__verify_module','V','Verification only','MODULO');
  insert into public.vivero_lines(id,location_id,code,display_name)
    values('__verify_line','__verify_module','L1','Verification only');
  insert into public.vivero_inventory(id,females,males,rootstocks,dead,counted_on)
    values('__verify_line',2,3,4,5,current_date);
  select total,version into t,v from public.vivero_inventory where id='__verify_line';
  if t<>9 or v<>1 then raise exception 'Wrong total or version'; end if;
  update public.vivero_inventory set females=0,males=0,rootstocks=0,version=1 where id='__verify_line';
  select total,version into t,v from public.vivero_inventory where id='__verify_line';
  if t<>0 or v<>2 then raise exception 'Zero inventory was lost'; end if;
  begin
    update public.vivero_inventory set females=10,version=1 where id='__verify_line';
    raise exception 'Stale update accepted';
  exception when serialization_failure then failures:=failures+1; end;
  begin
    update public.vivero_inventory set females=-1,version=2 where id='__verify_line';
    raise exception 'Negative count accepted';
  exception when check_violation then failures:=failures+1; end;
  insert into public.vivero_documents(id,kind,record_date,payload) values
    ('__verify_daily','DAILY','2026-11-03','{"id":"__verify_daily","date":"2026-11-03","title":"Verification only","start":"06:00","end":"07:00","location":"V","collaborators":[],"notes":""}'),
    ('__verify_application','APPLICATIONS','2026-11-03','{"id":"__verify_application","date":"2026-11-03","product":"Verification only - not a product","location":"V","applicationType":"Verification","executor":"Verification"}'),
    ('__verify_monitoring','MONITORING','2026-11-03','{"id":"__verify_monitoring","date":"2026-11-03","responsible":"Untrusted name","groups":[]}'),
    ('__verify_grafting','GRAFTING','2026-11-03','{"id":"__verify_grafting","date":"2026-11-03","responsible":"Untrusted name","formType":"PV_F007_YEMAS","samples":[],"yemaCollections":[]}');
  if (select payload->>'responsible' from public.vivero_documents where id='__verify_monitoring') <> 'Administrador' then
    raise exception 'Author was not derived from the authenticated user';
  end if;
  if (select count(*) from public.vivero_audit) <> 8 then raise exception 'Missing audit entries'; end if;
  begin
    update public.vivero_members set role='SUPERVISOR';
    raise exception 'Client can change memberships';
  exception when insufficient_privilege then failures:=failures+1; end;
  if failures<>3 then raise exception 'Missing rejection checks'; end if;
end $$;
-- Existing warehouse account without a Vivero membership: cannot read/write Vivero.
select set_config('request.jwt.claim.sub','9df4bf85-5e02-4c18-8bbd-3fed0b6b3dfc',true);
do $$ begin
  if exists(select 1 from public.vivero_documents) or exists(select 1 from public.vivero_inventory) then
    raise exception 'Cross-application access allowed';
  end if;
  begin
    insert into public.vivero_locations(id,code,display_name,type) values('__forbidden','X','Forbidden','MODULO');
    raise exception 'Non-member write allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin
    perform * from public.vivero_inventory;
    raise exception 'Anonymous read allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
