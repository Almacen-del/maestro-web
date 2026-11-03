-- Short integration test. All fixture rows, inventory changes and audits roll back.
begin;
do $$
declare member_row record;
begin
  select user_id,display_name into member_row from public.vivero_members
    where active and role='ADMINISTRADOR' order by user_id limit 1;
  if member_row.user_id is null then raise exception 'An active Vivero administrator is required'; end if;
  perform set_config('request.jwt.claim.sub',member_row.user_id::text,true);
  perform set_config('vivero.test_name',member_row.display_name,true);
  perform set_config('vivero.test_id','__validation_'||gen_random_uuid()::text,true);
end $$;
set local role authenticated;
do $$
declare
  k text := current_setting('vivero.test_id');
  rejected integer := 0;
  row_case record;
  body jsonb;
  docs_before bigint;
  audit_before bigint;
begin
  select count(*) into docs_before from public.vivero_documents;
  select count(*) into audit_before from public.vivero_audit;
  insert into public.vivero_locations(id,code,display_name,type) values(k,'TEST','Rollback only','MODULO');
  insert into public.vivero_lines(id,location_id,code,display_name) values(k,k,'TEST','Rollback only');
  insert into public.vivero_inventory(id,females,males,rootstocks,dead,counted_on,responsible_name)
    values(k,2,3,4,5,current_date,'Untrusted author');
  update public.vivero_inventory set females=0,males=0,rootstocks=0,version=1 where id=k;
  update public.vivero_inventory set counted_on=current_date+1,version=2 where id=k;
  if (select count(*) from public.vivero_inventory_counts where line_id=k)<>3
     or (select total from public.vivero_inventory_counts where line_id=k and inventory_version=1)<>9
     or (select total from public.vivero_inventory_counts where line_id=k and inventory_version=2)<>0
     or exists(select 1 from public.vivero_inventory_counts where line_id=k and
       (recorded_by<>auth.uid() or responsible_name<>current_setting('vivero.test_name') or location_id<>k)) then
    raise exception 'Inventory history, totals, zero or server authorship failed';
  end if;
  begin
    update public.vivero_inventory set females=10,version=1 where id=k;
    raise exception 'Stale inventory update accepted';
  exception when serialization_failure then rejected:=rejected+1; end;
  begin
    update public.vivero_inventory set females=-1,version=3 where id=k;
    raise exception 'Negative inventory accepted';
  exception when check_violation then rejected:=rejected+1; end;
  begin
    update public.vivero_inventory_counts set females=1 where line_id=k;
    raise exception 'History can be edited';
  exception when insufficient_privilege then rejected:=rejected+1; end;
  begin
    delete from public.vivero_inventory_counts where line_id=k;
    raise exception 'History can be deleted';
  exception when insufficient_privilege then rejected:=rejected+1; end;
  begin
    insert into public.vivero_inventory_counts(line_id,location_id,inventory_version,females,males,rootstocks,dead,counted_on,responsible_name,recorded_by,recorded_at)
      values(k,k,99,1,1,1,1,current_date,'Forged',auth.uid(),now());
    raise exception 'History can be forged';
  exception when insufficient_privilege then rejected:=rejected+1; end;
  if (select count(*) from public.vivero_inventory_counts where line_id=k)<>3
     or (select version from public.vivero_inventory where id=k)<>3 then
    raise exception 'Rejected writes modified the inventory or history';
  end if;

  for row_case in select * from (values
    ('DAILY','daily','{"title":"Rollback only","start":"06:00","end":"07:00","location":"TEST","collaborators":["Worker"],"notes":"","plants":0,"quantity":0,"workerDetails":[{"name":"Worker","start":"06:00","end":"07:00","quantity":0}]}'::jsonb),
    ('APPLICATIONS','application','{"product":"TEST - NOT FOR USE","location":"TEST","applicationType":"TEST","executor":"Worker","dosePerLiter":0.25,"waterLiters":"NOT_APPLICABLE","totalDose":0,"observations":""}'::jsonb),
    ('MONITORING','monitoring','{"responsible":"Untrusted","groups":[{"id":"watering","criteria":[{"index":0,"status":"FAIL","treatments":["CORRECTION"]}]}]}'::jsonb),
    ('GRAFTING','graft','{"responsible":"Untrusted","formType":"PV_F008_INJERTACION","samples":[{"id":"s1","sampleNumber":1,"module":"TEST","bed":"1","line":"1","stemThicknessMm":1.5,"rootstockCriteria":[{"status":"C"}]}],"yemaCollections":[]}'::jsonb),
    ('GRAFTING','bud','{"responsible":"Untrusted","formType":"PV_F007_YEMAS","samples":[],"yemaCollections":[{"id":"b1","collectionDate":"2026-11-03","lot":"2026-03","line":"1","gender":"Hembra","motherTree":"TEST","yemaQuantity":0}]}'::jsonb)
  ) as x(kind,suffix,payload) loop
    body:=row_case.payload||jsonb_build_object('id',k||row_case.suffix,'date',current_date::text);
    insert into public.vivero_documents(id,kind,record_date,payload) values(k||row_case.suffix,row_case.kind,current_date,body);
  end loop;

  for row_case in select * from (values
    ('daily','{"plants":-1}'::jsonb),
    ('daily','{"plants":1.5}'::jsonb),
    ('daily','{"collaborators":[7]}'::jsonb),
    ('daily','{"workerDetails":[{"name":"Worker","start":"25:00","end":"07:00"}]}'::jsonb),
    ('daily','{"start":"","end":""}'::jsonb),
    ('daily','{"notes":null}'::jsonb),
    ('daily','{"schemaVersion":2}'::jsonb),
    ('application','{"dosePerLiter":-0.1}'::jsonb),
    ('application','{"waterLiters":"100"}'::jsonb),
    ('application','{"executor":null}'::jsonb),
    ('application','{"time":"26:00"}'::jsonb),
    ('monitoring','{"groups":[{"id":"watering","criteria":[{"index":0,"status":"INVALID"}]}]}'::jsonb),
    ('monitoring','{"groups":[{"id":"watering","criteria":[{"index":4,"status":"PASS"}]}]}'::jsonb),
    ('monitoring','{"groups":[{"id":"watering","criteria":[{"index":0,"status":"PASS"},{"index":0,"status":"FAIL"}]}]}'::jsonb),
    ('monitoring','{"groups":[{"id":"watering","criteria":[]},{"id":"watering","criteria":[]}]}'::jsonb),
    ('graft','{"samples":[{"id":"s1","sampleNumber":1,"module":"TEST","bed":"1","line":"1","stemThicknessMm":-1}]}'::jsonb),
    ('graft','{"totalGraftsCount":0.5}'::jsonb),
    ('bud','{"yemaCollections":[{"id":"b1","collectionDate":"2026-02-30","lot":"2026-03","line":"1","gender":"Hembra","motherTree":"TEST"}]}'::jsonb),
    ('bud','{"yemaCollections":[{"id":"b1","collectionDate":"2026-11-03","lot":"2026-03","line":"1","gender":"Hembra","motherTree":"TEST","yemaQuantity":-1}]}'::jsonb),
    ('bud','{"formType":"PV_F008_INJERTACION"}'::jsonb)
  ) as x(suffix,patch) loop
    begin
      update public.vivero_documents set payload=payload||row_case.patch,version=1 where id=k||row_case.suffix;
      raise exception 'Invalid document accepted: %',row_case.patch;
    exception when check_violation then rejected:=rejected+1; end;
  end loop;
  if rejected<>25 then raise exception 'Incomplete rejection checks: %',rejected; end if;
  if (select count(*) from public.vivero_documents)<>docs_before+5
     or exists(select 1 from public.vivero_documents where id in (k||'daily',k||'application',k||'monitoring',k||'graft',k||'bud') and version<>1)
     or (select count(*) from public.vivero_audit)<>audit_before+10 then
    raise exception 'Rejected forms changed persisted data or audit';
  end if;
  if (select payload->>'responsible' from public.vivero_documents where id=k||'monitoring')<>current_setting('vivero.test_name') then
    raise exception 'Server authorship was lost';
  end if;
end $$;
-- Random identity with no membership: no Vivero rows or writes.
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$ begin
  if exists(select 1 from public.vivero_inventory_counts) then raise exception 'Nonmember can read history'; end if;
  begin
    update public.vivero_inventory set version=3 where id=current_setting('vivero.test_id');
    if found then raise exception 'Nonmember can update inventory'; end if;
  end;
end $$;
set local role anon;
do $$ begin
  begin
    perform 1 from public.vivero_inventory_counts;
    raise exception 'Anonymous history access allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: 5 valid forms, 25 rejected writes, automatic immutable history, nonmember/anonymous isolation; fixtures rolled back' as result;
