-- Vivero only: retain the existing member write policies and current quantities.
-- Official forms keep their existing JSON shape; validation runs in the database.
create extension if not exists pg_jsonschema with schema extensions;

create function vivero_private.validate_document_payload() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
  base_schema jsonb := $json${
    "type":"object", "required":["id","date"],
    "properties":{
      "id":{"type":"string","minLength":1,"maxLength":160,"pattern":"\\S"},
      "date":{"type":"string","pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}$","format":"date"},
      "schemaVersion":{"const":1}
    },
    "$defs":{
      "text":{"type":"string","maxLength":10000},
      "label":{"type":"string","maxLength":2000},
      "name":{"type":"string","minLength":1,"maxLength":160,"pattern":"\\S"},
      "requiredLabel":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},
      "count":{"type":"integer","minimum":0,"maximum":1000000000},
      "quantity":{"type":"number","minimum":0,"maximum":1000000000},
      "nullableCount":{"anyOf":[{"$ref":"#/$defs/count"},{"type":"null"}]},
      "time":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]$"},
      "optionalTime":{"type":"string","pattern":"^$|^([01][0-9]|2[0-3]):[0-5][0-9]$"},
      "dose":{"anyOf":[{"$ref":"#/$defs/quantity"},{"const":"NOT_APPLICABLE"}]},
      "assessment":{
        "type":"object", "properties":{
          "status":{"enum":["C","NC","N.A",null]},
          "treatment":{"$ref":"#/$defs/text"},"notes":{"$ref":"#/$defs/text"}
        }
      },
      "assessments":{"type":"array","maxItems":3,"items":{"$ref":"#/$defs/assessment"}}
    }
  }$json$::jsonb;
  form_schema jsonb;
  item jsonb;
  limit_index integer;
  parsed_date date;
begin
  form_schema := case new.kind
    when 'DAILY' then $json${
      "required":["title","start","end","location","collaborators","notes"],
      "properties":{
        "title":{"$ref":"#/$defs/requiredLabel"},"location":{"$ref":"#/$defs/requiredLabel"},
        "start":{"$ref":"#/$defs/optionalTime"},"end":{"$ref":"#/$defs/optionalTime"},
        "collaborators":{"type":"array","maxItems":100,"uniqueItems":true,"items":{"$ref":"#/$defs/name"}},
        "notes":{"$ref":"#/$defs/text"},"recordedByName":{"$ref":"#/$defs/name"},
        "plants":{"$ref":"#/$defs/count"},"quantity":{"$ref":"#/$defs/quantity"},
        "unit":{"$ref":"#/$defs/label"},"individualHours":{"type":"boolean"},
        "workerDetails":{"type":"array","maxItems":100,"items":{
          "type":"object","required":["name","start","end"],"properties":{
            "name":{"$ref":"#/$defs/name"},"start":{"$ref":"#/$defs/time"},
            "end":{"$ref":"#/$defs/time"},"quantity":{"$ref":"#/$defs/quantity"}
          }
        }}
      }
    }$json$::jsonb
    when 'APPLICATIONS' then $json${
      "required":["product","location","applicationType","executor"],
      "properties":{
        "product":{"$ref":"#/$defs/requiredLabel"},"location":{"$ref":"#/$defs/requiredLabel"},
        "applicationType":{"$ref":"#/$defs/requiredLabel"},"executor":{"$ref":"#/$defs/name"},
        "time":{"$ref":"#/$defs/time"},"beds":{"$ref":"#/$defs/label"},"lines":{"$ref":"#/$defs/label"},
        "activeIngredient":{"$ref":"#/$defs/label"},"unit":{"$ref":"#/$defs/label"},
        "dosePerLiter":{"$ref":"#/$defs/dose"},"waterLiters":{"$ref":"#/$defs/dose"},"totalDose":{"$ref":"#/$defs/dose"},
        "objective":{"$ref":"#/$defs/text"},"recordedBy":{"$ref":"#/$defs/name"},"observations":{"$ref":"#/$defs/text"}
      }
    }$json$::jsonb
    when 'MONITORING' then $json${
      "required":["responsible","groups"],"properties":{
        "responsible":{"$ref":"#/$defs/name"},"director":{"$ref":"#/$defs/label"},"observations":{"$ref":"#/$defs/text"},
        "groups":{"type":"array","maxItems":6,"items":{
          "type":"object","required":["id","criteria"],"properties":{
            "id":{"enum":["weeding","watering","fertilization","delivery","seed","transplant"]},
            "observations":{"$ref":"#/$defs/text"},
            "fields":{"type":"array","maxItems":20,"items":{"type":"object","required":["label","value"],"properties":{
              "label":{"$ref":"#/$defs/requiredLabel"},"value":{"$ref":"#/$defs/text"}
            }}},
            "criteria":{"type":"array","maxItems":5,"items":{"type":"object","required":["index","status"],"properties":{
              "index":{"type":"integer","minimum":0,"maximum":4},
              "status":{"enum":["PASS","FAIL","NOT_APPLICABLE","UNASSESSED"]},
              "observations":{"$ref":"#/$defs/text"},
              "treatments":{"type":"array","maxItems":3,"uniqueItems":true,"items":{"enum":["CORRECTION","RETURN","CONCESSION"]}}
            }}}
          }
        }}
      }
    }$json$::jsonb
    when 'GRAFTING' then $json${
      "required":["responsible","formType","samples","yemaCollections"],"properties":{
        "responsible":{"$ref":"#/$defs/name"},"formType":{"enum":["PV_F008_INJERTACION","PV_F007_YEMAS"]},
        "notes":{"$ref":"#/$defs/text"},"totalGraftsCount":{"$ref":"#/$defs/nullableCount"},"evaluatedSamplesCount":{"$ref":"#/$defs/nullableCount"},
        "samples":{"type":"array","maxItems":500,"items":{
          "type":"object","required":["id","sampleNumber","module","bed","line"],"properties":{
            "id":{"$ref":"#/$defs/name"},"sampleNumber":{"type":"integer","minimum":1,"maximum":1000000},
            "module":{"$ref":"#/$defs/requiredLabel"},"bed":{"$ref":"#/$defs/requiredLabel"},"line":{"$ref":"#/$defs/requiredLabel"},
            "treeAge":{"$ref":"#/$defs/label"},"stemThicknessMm":{"anyOf":[{"$ref":"#/$defs/quantity"},{"type":"null"}]},
            "healthyCondition":{"enum":["C","NC","N.A",null]},"notes":{"$ref":"#/$defs/text"},"ncTreatment":{"$ref":"#/$defs/text"},
            "rootstockCriteria":{"$ref":"#/$defs/assessments"},"graftCriteria":{"$ref":"#/$defs/assessments"},
            "graftNotes":{"$ref":"#/$defs/text"},"graftNcTreatment":{"$ref":"#/$defs/text"}
          }
        }},
        "yemaCollections":{"type":"array","maxItems":500,"items":{
          "type":"object","required":["id","collectionDate","lot","line","gender","motherTree"],"properties":{
            "id":{"$ref":"#/$defs/name"},"collectionDate":{"type":"string","pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}$","format":"date"},
            "lot":{"$ref":"#/$defs/requiredLabel"},"line":{"$ref":"#/$defs/requiredLabel"},"gender":{"$ref":"#/$defs/requiredLabel"},
            "motherTree":{"$ref":"#/$defs/requiredLabel"},"yemaQuantity":{"$ref":"#/$defs/nullableCount"},
            "notes":{"$ref":"#/$defs/text"},"criteria":{"$ref":"#/$defs/assessments"}
          }
        }}
      }
    }$json$::jsonb
    else null
  end;
  if form_schema is null or not extensions.jsonb_matches_schema(
    (base_schema || jsonb_build_object('allOf',jsonb_build_array(form_schema)))::json,new.payload
  ) then
    raise exception 'El formulario contiene campos, cantidades o detalles inválidos (%)',new.kind using errcode='23514';
  end if;

  if new.kind='DAILY' then
    if coalesce((new.payload->>'individualHours')::boolean,false) then
      if coalesce(jsonb_array_length(new.payload->'workerDetails'),0)=0 then
        raise exception 'Faltan los horarios por colaborador' using errcode='23514';
      end if;
    elsif new.payload->>'start'='' or new.payload->>'end'='' then
      raise exception 'Falta el horario de la actividad' using errcode='23514';
    end if;
  elsif new.kind='MONITORING' then
    if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(new.payload->'groups') x) then
      raise exception 'Proceso de monitoreo repetido' using errcode='23514';
    end if;
    for item in select value from jsonb_array_elements(new.payload->'groups') loop
      limit_index := case item->>'id' when 'weeding' then 2 when 'watering' then 1 when 'fertilization' then 1 when 'delivery' then 3 when 'seed' then 2 when 'transplant' then 4 end;
      if exists(select 1 from jsonb_array_elements(item->'criteria') x where (x->>'index')::numeric>limit_index)
         or (select count(*)<>count(distinct (x->>'index')::numeric) from jsonb_array_elements(item->'criteria') x) then
        raise exception 'Criterio de monitoreo inválido o repetido' using errcode='23514';
      end if;
    end loop;
  elsif new.kind='GRAFTING' then
    if (select count(*)<>count(distinct x->>'id') or count(*)<>count(distinct (x->>'sampleNumber')::numeric) from jsonb_array_elements(new.payload->'samples') x)
       or (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(new.payload->'yemaCollections') x) then
      raise exception 'Muestra o recolección repetida' using errcode='23514';
    end if;
    if (new.payload->>'formType'='PV_F007_YEMAS' and jsonb_array_length(new.payload->'samples')>0)
       or (new.payload->>'formType'='PV_F008_INJERTACION' and jsonb_array_length(new.payload->'yemaCollections')>0) then
      raise exception 'El detalle no corresponde al tipo de formato' using errcode='23514';
    end if;
    for item in select value from jsonb_array_elements(new.payload->'yemaCollections') loop
      begin
        parsed_date := (item->>'collectionDate')::date;
      exception when invalid_datetime_format or datetime_field_overflow then
        raise exception 'Fecha de recolección inválida' using errcode='23514';
      end;
      if to_char(parsed_date,'YYYY-MM-DD')<>item->>'collectionDate' then
        raise exception 'Fecha de recolección inválida' using errcode='23514';
      end if;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function vivero_private.validate_document_payload() from public,anon,authenticated;
-- Alphabetically after vivero_stamp, so server-controlled authorship is validated.
create trigger vivero_validate_document before insert or update on public.vivero_documents
  for each row execute function vivero_private.validate_document_payload();

create table public.vivero_inventory_counts (
  id uuid primary key default gen_random_uuid(),
  line_id text not null references public.vivero_lines(id),
  location_id text not null references public.vivero_locations(id),
  inventory_version integer not null check (inventory_version>0),
  females integer not null check (females between 0 and 100000000),
  males integer not null check (males between 0 and 100000000),
  rootstocks integer not null check (rootstocks between 0 and 100000000),
  dead integer not null check (dead between 0 and 100000000),
  total integer generated always as (females+males+rootstocks) stored,
  counted_on date not null,
  responsible_name text not null check (length(trim(responsible_name)) between 1 and 160),
  recorded_by uuid not null references public.vivero_members(user_id),
  recorded_at timestamptz not null,
  unique(line_id,inventory_version)
);
create index vivero_inventory_counts_line_date_idx on public.vivero_inventory_counts(line_id,counted_on desc,inventory_version desc);
create index vivero_inventory_counts_date_idx on public.vivero_inventory_counts(counted_on desc,id);
create index vivero_inventory_counts_location_idx on public.vivero_inventory_counts(location_id);
create index vivero_inventory_counts_author_idx on public.vivero_inventory_counts(recorded_by);
alter table public.vivero_inventory_counts enable row level security;
revoke all on public.vivero_inventory_counts from public,anon,authenticated;
grant select on public.vivero_inventory_counts to authenticated;
create policy vivero_inventory_counts_read on public.vivero_inventory_counts for select to authenticated
  using (exists(select 1 from public.vivero_members where user_id=(select auth.uid()) and active));

-- The only writer is this internal trigger. A rejected inventory update produces no history.
create function vivero_private.record_inventory_count() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or new.updated_by is distinct from auth.uid()
     or not exists(select 1 from public.vivero_members where user_id=auth.uid() and active) then
    raise exception 'Cuenta sin acceso a Vivero' using errcode='42501';
  end if;
  insert into public.vivero_inventory_counts(
    line_id,location_id,inventory_version,females,males,rootstocks,dead,counted_on,responsible_name,recorded_by,recorded_at
  ) select new.id,l.location_id,new.version,new.females,new.males,new.rootstocks,new.dead,new.counted_on,new.responsible_name,new.updated_by,new.updated_at
    from public.vivero_lines l where l.id=new.id;
  return new;
end;
$$;
revoke all on function vivero_private.record_inventory_count() from public,anon,authenticated;
create trigger vivero_inventory_history after insert or update on public.vivero_inventory
  for each row execute function vivero_private.record_inventory_count();
comment on table public.vivero_inventory_counts is
  'Immutable snapshots of accepted inventory writes after this migration. No historical counts are fabricated or backfilled.';
alter publication supabase_realtime add table public.vivero_inventory_counts;
notify pgrst,'reload schema';
