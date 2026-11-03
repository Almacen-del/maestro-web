-- Imported records are already committed. All verification writes below roll back.
begin;
do $$ begin
  perform set_config('request.jwt.claim.sub',(select user_id::text from public.vivero_members where active and role='ADMINISTRADOR' order by user_id limit 1),true);
end $$;
set local role authenticated;
do $$
declare rejected integer:=0; sample public.vivero_inventory_history;
begin
  if (select count(*) from public.vivero_inventory_history)<>750 or
     (select sum(total) from public.vivero_inventory_effective)<>43727 then
    raise exception 'Imported counts or latest snapshot failed';
  end if;
  if (select rootstocks from public.vivero_inventory_history where id='2026-04:G3-L3')<>76 or
     (select counted_on from public.vivero_inventory_history where id='2026-06:M3-C2-L38')<>'2026-06-23'::date then
    raise exception 'Excel priority or date normalization failed';
  end if;
  if exists(select 1 from public.vivero_inventory_effective where id in ('M5-C2-L14','G2-L3')) then
    raise exception 'An absent latest-period row was incorrectly carried forward';
  end if;
  begin
    update public.vivero_inventory_history set rootstocks=1 where id='2026-04:G3-L3';
    raise exception using errcode='P0004',message='Historical rows can be edited';
  exception when insufficient_privilege then rejected:=rejected+1; end;
  begin
    update public.vivero_inventory_periods set published=false where id='2026-04';
    raise exception using errcode='P0004',message='Published period can be reopened';
  exception when raise_exception then rejected:=rejected+1; end;
  begin
    select * into sample from public.vivero_inventory_history where id='2026-04:G3-L3';
    sample.id:='__late_insert';
    insert into public.vivero_inventory_history(id,period_id,line_id,location_id,females,males,rootstocks,dead,counted_on,responsible_name,source_sheet,source_row,source_cells)
      values(sample.id,sample.period_id,sample.line_id,sample.location_id,0,0,0,0,sample.counted_on,sample.responsible_name,'TEST',1,'{}');
    raise exception using errcode='P0004',message='Published cut accepts late rows';
  exception when raise_exception then rejected:=rejected+1; end;
  -- An older live count cannot replace the latest imported count.
  insert into public.vivero_inventory(id,females,males,rootstocks,dead,counted_on)
    values('M1-C1-L1',0,0,1,0,'2026-08-01');
  if (select origin from public.vivero_inventory_effective where id='M1-C1-L1')<>'HISTORICO' then raise exception 'Old count overwrote snapshot'; end if;
  -- A newer real zero is valid and replaces that line only, not the saved history.
  update public.vivero_inventory set rootstocks=0,counted_on='2026-11-03',version=1 where id='M1-C1-L1';
  if (select total from public.vivero_inventory_effective where id='M1-C1-L1')<>0 or
     (select origin from public.vivero_inventory_effective where id='M1-C1-L1')<>'SUPABASE' or
     (select count(*) from public.vivero_inventory_history)<>750 then raise exception 'Live zero or history preservation failed'; end if;
  if rejected<>3 then raise exception 'Incomplete guard checks'; end if;
end $$;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$ begin
  if exists(select 1 from public.vivero_inventory_history) or exists(select 1 from public.vivero_inventory_periods) or exists(select 1 from public.vivero_inventory_effective) then
    raise exception 'A nonmember can read Vivero';
  end if;
end $$;
set local role anon;
do $$ begin
  begin perform 1 from public.vivero_inventory_effective; raise exception using errcode='P0004',message='Anonymous can read Vivero';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: imported totals, Excel priority, corrected dates, immutable cuts, current-count precedence, zero, RLS; writes rolled back' as result;
