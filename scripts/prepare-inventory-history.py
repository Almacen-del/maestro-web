"""Read-only XLSX extraction. Writes private import artifacts, never edits originals.

Usage: python prepare-inventory-history.py source.zip output-directory
The user selected Excel quantities over scanned PDF quantities. PDF is provenance only.
"""
import ast
import datetime as dt
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import unicodedata
import zipfile
import openpyxl


def text(value):
    if isinstance(value, (dt.datetime, dt.date)):
        return value.date().isoformat() if isinstance(value, dt.datetime) else value.isoformat()
    return value


def date(value):
    if isinstance(value, (dt.datetime, dt.date)):
        return text(value)
    parts = re.fullmatch(r'(\d{1,2})/+(\d{1,2})/+(\d{4})', str(value).strip())
    if not parts:
        raise ValueError(f'Fecha no interpretable: {value!r}')
    day, month, year = map(int, parts.groups())
    return dt.date(year, month, day).isoformat()


def arithmetic(formula):
    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            return node.value
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub)):
            a, b = visit(node.left), visit(node.right)
            return a + b if isinstance(node.op, ast.Add) else a - b
        raise ValueError('Fórmula de cantidad no admitida: ' + formula)
    return visit(ast.parse(formula.removeprefix('='), mode='eval').body)


def quantity(cell, cached):
    value = cached.value
    if cell.data_type == 'f' and arithmetic(cell.value) != value:
        raise ValueError(f'Caché de fórmula inconsistente en {cell.coordinate}')
    if value is None or (isinstance(value, str) and value.strip() in ('', '-')):
        return 0
    if type(value) not in (int, float) or value != int(value) or not 0 <= value <= 100000000:
        raise ValueError(f'Cantidad inválida: {cell.coordinate}: {value!r}')
    return int(value)


def normalize(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value) if not unicodedata.combining(c)).strip().upper()


def extract(source):
    periods = []
    locations = {'VIVERO':dict(id='VIVERO',parent_id=None,code='VIVERO',display_name='Vivero Arlés',type='VIVERO',sort_order=0)}
    lines = {}
    with zipfile.ZipFile(source) as archive:
        entries = sorted((n for n in archive.namelist() if n.endswith('.xlsx')), key=lambda n: ('MARZO' not in n, 'JUNIO' not in n, n))
        for name in entries:
            raw = archive.read(name)
            formulas = openpyxl.load_workbook(io.BytesIO(raw),data_only=False)
            cached = openpyxl.load_workbook(io.BytesIO(raw),data_only=True)
            records, sheet_manifest = [], []
            for ws in formulas:
                if normalize(ws.title) == 'CONTROL DE CAMBIOS':
                    continue
                header = next((c for row in ws for c in row if normalize(str(c.value)) == 'LINEA'),None)
                if header is None:
                    raise ValueError('Hoja sin columna de línea: '+ws.title)
                r0, lc = header.row, header.column
                assert normalize(str(ws.cell(r0,lc-1).value)) == 'CAMA'
                assert normalize(str(ws.cell(r0,lc+1).value)) == 'PLANTAS PATRON'
                responsible = str(ws.cell(r0-2,lc+5).value or '').strip()
                if not responsible:
                    raise ValueError('Falta el responsable: '+ws.title)
                normalized_sheet = normalize(ws.title)
                module_match = re.fullmatch(r'MODULO\s+(\d+)', normalized_sheet)
                module = 'M'+module_match[1] if module_match else normalized_sheet
                sheet_records = []
                totals = None
                for row in ws.iter_rows(min_row=r0+1):
                    if normalize(str(row[lc-3].value)) == 'TOTAL':
                        totals = [cached[ws.title].cell(row[0].row,lc+i).value for i in range(1,5)]
                        break
                    line = row[lc-1].value
                    if not isinstance(line,(int,float)):
                        if any(isinstance(c.value,(int,float)) for c in row[lc:lc+4]):
                            raise ValueError('Cantidades sin línea: '+ws.title+':'+str(row[0].row))
                        continue
                    if line != int(line) or line < 1:
                        raise ValueError('Línea inválida')
                    line = int(line)
                    original_bed = row[lc-2].value
                    if module == 'G2-G3':
                        location_code = str(original_bed).strip().upper()
                        if location_code not in ('G2','G3'):
                            raise ValueError('Germinador desconocido')
                        bed = None
                    else:
                        location_code = module
                        if not isinstance(original_bed,(int,float)) or original_bed != int(original_bed) or original_bed < 1:
                            raise ValueError('Cama inválida')
                        bed = int(original_bed)
                    is_germinator = location_code.startswith('G')
                    number = int(re.search(r'\d+',location_code)[0])
                    label = ('Germinador ' if is_germinator else 'Módulo ')+str(number)
                    locations[location_code] = dict(id=location_code,parent_id='VIVERO',code=location_code,display_name=label,type='GERMINADOR' if is_germinator else 'MODULO',sort_order=number+(10 if is_germinator else 0))
                    location_id = location_code
                    if bed is not None:
                        location_id += '-C'+str(bed)
                        locations[location_id] = dict(id=location_id,parent_id=location_code,code='C'+str(bed),display_name='Cama '+str(bed),type='CAMA',sort_order=bed)
                    # Germinator line identity remains stable when earlier paper omitted the bed.
                    line_id = (location_code if is_germinator else location_id)+'-L'+str(line)
                    display_name = label+(' · Cama '+str(bed) if bed else '')+' · Línea '+str(line)
                    lines[line_id] = dict(id=line_id,location_id=location_id,code='L'+str(line),display_name=display_name,sort_order=line)
                    amounts = [quantity(row[lc+i],cached[ws.title][row[lc+i].coordinate]) for i in range(4)]
                    record = dict(line_id=line_id,location_id=location_id,rootstocks=amounts[0],females=amounts[1],males=amounts[2],dead=amounts[3],counted_on=date(row[lc-3].value),responsible_name=responsible,observations=str(row[lc+4].value or '').strip(),source_sheet=ws.title,source_row=row[0].row,
                        source_cells={c.coordinate:text(c.value) for c in row[lc-3:lc+5]})
                    sheet_records.append(record)
                calculated = [sum(r[k] for r in sheet_records) for k in ('rootstocks','females','males','dead')]
                if totals is None:
                    raise ValueError('Falta la fila total: '+ws.title)
                for expected, actual in zip(totals,calculated):
                    if isinstance(expected,(int,float)) and expected != actual:
                        raise ValueError(f'Total de Excel no coincide: {ws.title}: {expected} != {actual}')
                records.extend(sheet_records)
                dates = sorted(r['counted_on'] for r in sheet_records)
                sheet_manifest.append(dict(sheet=ws.title,original_location=text(ws.cell(r0-2,lc-1).value),original_start=text(ws.cell(r0-2,lc+1).value),original_end=text(ws.cell(r0-2,lc+3).value),first_counted_on=dates[0],last_counted_on=dates[-1],rows=len(sheet_records),totals=calculated))
            months = {r['counted_on'][:7] for r in records}
            if len(months) != 1:
                raise ValueError('El archivo contiene cortes de meses distintos: '+name)
            period = months.pop()
            for r in records:
                r.update(id=period+':'+r['line_id'],period_id=period)
            if len({r['id'] for r in records}) != len(records):
                raise ValueError('Línea duplicada en el corte: '+period)
            dates = sorted(r['counted_on'] for r in records)
            pdf_name = name.replace('/INVENTARIO ', '/INVENTARIO FISICO/INVENTARIO ').replace('.xlsx','.pdf')
            pdf_info = dict(file=Path(pdf_name).name,sha256=hashlib.sha256(archive.read(pdf_name)).hexdigest()) if pdf_name in archive.namelist() else None
            periods.append(dict(id=period,source_file=Path(name).name,source_sha256=hashlib.sha256(raw).hexdigest(),source_manifest=dict(archive_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),sheets=sheet_manifest,pdf=pdf_info,quantity_source='EXCEL',blank_quantities=0),first_counted_on=dates[0],last_counted_on=dates[-1],expected_rows=len(records),expected_live=sum(r['rootstocks']+r['females']+r['males'] for r in records),expected_dead=sum(r['dead'] for r in records),records=records))
    return dict(locations=list(locations.values()),lines=list(lines.values()),periods=periods)


def literal(value):
    return "'"+json.dumps(value,ensure_ascii=False,separators=(',',':')).replace("'","''")+"'::jsonb"


def sql_for(data):
    # All writes use explicit Vivero tables. RLS, provenance and audit triggers stay enabled.
    statements = ["begin;", "do $$ declare actor uuid; begin select m.user_id into actor from public.vivero_members m join auth.users u on u.id=m.user_id where lower(u.email)='almacen@arlessas.com' and m.active and m.role='ADMINISTRADOR'; if actor is null then raise exception 'Falta administrador de Vivero'; end if; perform set_config('request.jwt.claim.sub',actor::text,true); end $$;", "set local role authenticated;"]
    for table, rows, columns in [
        ('vivero_locations',data['locations'],'id text,parent_id text,code text,display_name text,type text,sort_order integer'),
        ('vivero_lines',data['lines'],'id text,location_id text,code text,display_name text,sort_order integer'),
    ]:
        names = ','.join(c.split()[0] for c in columns.split(','))
        statements.append(f'insert into public.{table}({names}) select '+','.join('x.'+n for n in names.split(','))+f' from jsonb_to_recordset({literal(rows)}) as x({columns}) where not exists(select 1 from public.{table} t where t.id=x.id);')
        comparisons = ' or '.join(f't.{k} is distinct from x.{k}' for k in names.split(',') if k != 'id')
        statements.append(f"do $$ begin if exists(select 1 from jsonb_to_recordset({literal(rows)}) x({columns}) join public.{table} t on t.id=x.id where {comparisons}) then raise exception 'Catálogo incompatible: {table}'; end if; end $$;")
    period_cols='id text,source_file text,source_sha256 text,source_manifest jsonb,first_counted_on date,last_counted_on date,expected_rows integer,expected_live bigint,expected_dead bigint'
    row_cols='id text,period_id text,line_id text,location_id text,rootstocks integer,females integer,males integer,dead integer,counted_on date,responsible_name text,observations text,source_sheet text,source_row integer,source_cells jsonb'
    for period in data['periods']:
        meta={k:v for k,v in period.items() if k!='records'}
        names=','.join(c.split()[0] for c in period_cols.split(','))
        statements.append(f'insert into public.vivero_inventory_periods({names}) select '+','.join('x.'+n for n in names.split(','))+f' from jsonb_to_recordset({literal([meta])}) x({period_cols}) where not exists(select 1 from public.vivero_inventory_periods t where t.id=x.id);')
        statements.append(f"do $$ begin if not exists(select 1 from public.vivero_inventory_periods where id='{period['id']}' and source_sha256='{period['source_sha256']}') then raise exception 'El período tiene otro archivo de origen'; end if; end $$;")
        names=','.join(c.split()[0] for c in row_cols.split(','))
        for offset in range(0,len(period['records']),100):
            rows=period['records'][offset:offset+100]
            payload=literal(rows)
            statements.append(f'insert into public.vivero_inventory_history({names}) select '+','.join('x.'+n for n in names.split(','))+f' from jsonb_to_recordset({payload}) x({row_cols}) where not exists(select 1 from public.vivero_inventory_history t where t.id=x.id);')
            comparisons=' or '.join(f't.{k} is distinct from x.{k}' for k in names.split(',') if k!='id')
            statements.append(f"do $$ begin if exists(select 1 from jsonb_to_recordset({payload}) x({row_cols}) left join public.vivero_inventory_history t on t.id=x.id where t.id is null or {comparisons}) then raise exception 'La importación no coincide con el Excel'; end if; end $$;")
        statements.append(f"update public.vivero_inventory_periods set published=true where id='{period['id']}' and not published;")
    statements += ['commit;', "select p.id,count(h.id) as records,sum(h.total) as live,sum(h.dead) as dead from public.vivero_inventory_periods p join public.vivero_inventory_history h on h.period_id=p.id where p.published group by p.id order by p.id;"]
    return '\n'.join(statements)


if __name__=='__main__':
    source=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
    data=extract(source)
    (out/'normalized.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    (out/'import.sql').write_text(sql_for(data),encoding='utf-8')
    print(json.dumps(dict(locations=len(data['locations']),lines=len(data['lines']),periods=[{k:p[k] for k in ('id','expected_rows','expected_live','expected_dead','first_counted_on','last_counted_on')} for p in data['periods']]),ensure_ascii=False))
