import {excelDate,type CellValue,type ExportPage,type SheetTemplate} from './OfficialExport';
import type {DailyActivity} from './DailyProcessesSection';
import type {ApplicationRecord} from './ApplicationsSection';
import type {GraftingRecord} from './GraftingSection';
import type {MonitoringRecord} from './MonitoringSection';
import type {ManageableCatalogData,ManageableCatalogLine} from '../domain/MonitorModels';
type Cells=Record<string,CellValue>;
const columns=(start:number,count:number)=>Array.from({length:count},(_,i)=>String.fromCharCode(64+start+i));
const row=(cells:Cells,r:number,values:CellValue[],start=1)=>values.forEach((v,i)=>{cells[`${columns(start,values.length)[i]}${r}`]=v;});
export function dailyPages(sheets:SheetTemplate[],items:readonly DailyActivity[]):ExportPage[]{
 const s=sheets[0]!;const pages:ExportPage[]=[];
 for(let offset=0;offset<items.length;offset+=s.capacity!){const cells:Cells={};items.slice(offset,offset+s.capacity!).forEach((a,i)=>{
   const original=a.source?.columns;
   row(cells,s.start!+i,original ? [excelDate(a.date),...['B','C','D','E','F','G','H','I','J','K'].map(key=>original[key])] : [excelDate(a.date),a.collaborators.join(', '),a.title,a.start,a.end,a.location,null,null,null,a.quantity??a.plants,[a.notes,a.recordedByName?`Registrado por: ${a.recordedByName}`:'',a.unit?`Unidad: ${a.unit}`:'',a.workerDetails?.map(w=>`${w.name}: ${w.start}-${w.end}; cantidad ${w.quantity??'no registrada'}`).join('; ')].filter(Boolean).join('\n')]);
 });pages.push({name:'procesos-diarios',cells:{[s.path]:cells}});}return pages;
}
export function applicationPages(sheets:SheetTemplate[],items:readonly ApplicationRecord[]):ExportPage[]{
 const s=sheets[0]!;const pages:ExportPage[]=[];const q=(v:number|'NOT_APPLICABLE'|undefined)=>v==='NOT_APPLICABLE'?'N/A':v;
 for(let offset=0;offset<items.length;offset+=s.capacity!){const cells:Cells={};items.slice(offset,offset+s.capacity!).forEach((a,i)=>{
   const original=a.source?.columns;
   row(cells,s.start!+i,original ? [excelDate(a.date),...['B','C','D','E','F','G','H','I','J','K','L','M','N','O'].map(key=>original[key])] : [excelDate(a.date),a.time,a.location,a.beds,a.lines,a.product,a.activeIngredient,q(a.dosePerLiter),a.unit,q(a.waterLiters),q(a.totalDose),a.applicationType,a.objective,a.executor,[a.observations,a.recordedBy?`Registrado por: ${a.recordedBy}`:''].filter(Boolean).join('\n')]);
 });pages.push({name:'aplicaciones',cells:{[s.path]:cells}});}return pages;
}
export function graftPages(sheets:SheetTemplate[],record:GraftingRecord):ExportPage[]{
 const s=sheets[0]!;const pages:ExportPage[]=[];
 if(record.formType==='PV_F008_INJERTACION'){
  const groups=new Map<string,typeof record.samples>();for(const sample of record.samples){const key=sample.module+' / '+sample.bed;groups.set(key,[...(groups.get(key)??[]),sample]);}
  for(const samples of groups.values())for(let offset=0;offset<samples.length;offset+=22){const cells:Cells={D5:record.date.split("-").reverse().join("/"),L5:record.responsible,C8:record.evaluatedSamplesCount,C12:samples[0]!.module,G12:samples[0]!.bed,B40:[record.notes,record.totalGraftsCount!=null?`Injertaciones declaradas del registro completo: ${record.totalGraftsCount}`:''].filter(Boolean).join('\n')};samples.slice(offset,offset+22).forEach((a,i)=>row(cells,16+i,[a.sampleNumber,a.line,a.rootstockCriteria?.[0]?.status,a.rootstockCriteria?.[1]?.status,a.rootstockCriteria?.[2]?.status??a.healthyCondition,[a.notes,a.treeAge?`Edad: ${a.treeAge}`:'',a.stemThicknessMm!=null?`Grosor: ${a.stemThicknessMm} mm`:'',a.rootstockCriteria?.map(c=>[c.notes,c.treatment].filter(Boolean).join(': ')).filter(Boolean).join('; ')].filter(Boolean).join('\n'),a.ncTreatment,a.graftCriteria?.[0]?.status,a.graftCriteria?.[1]?.status,a.graftCriteria?.[2]?.status,[a.graftNotes,a.graftCriteria?.map(c=>[c.notes,c.treatment].filter(Boolean).join(': ')).filter(Boolean).join('; ')].filter(Boolean).join('\n'),a.graftNcTreatment],2));pages.push({name:`injertos-${record.id}`,cells:{[s.path]:cells}});}
 }else{
  for(let offset=0;offset<record.yemaCollections.length;offset+=6){const cells:Cells={B4:record.date.split("-").reverse().join("/"),E4:record.responsible,A55:record.notes};record.yemaCollections.slice(offset,offset+6).forEach((a,i)=>{const r=11+i*7;Object.assign(cells,{[`B${r}`]:a.lot,[`D${r}`]:a.line,[`F${r}`]:a.motherTree,[`B${r+1}`]:a.yemaQuantity,[`D${r+1}`]:a.gender});for(let j=0;j<3;j++){const c=a.criteria?.[j];row(cells,r+4+j,[c?.status==='C'?'X':null,c?.status==='NC'?'X':null,c?.status==='N.A'?'X':null,c?.treatment,[c?.notes,j===0?a.notes:'',j===0&&a.collectionDate!==record.date?`Fecha recolección: ${a.collectionDate || "No registrada"}`:''].filter(Boolean).join('\n')],2);}});pages.push({name:`yemas-${record.id}`,cells:{[s.path]:cells}});}
 }return pages;
}
export function monitoringPages(sheets:SheetTemplate[],record:MonitoringRecord):ExportPage[]{
 const s=sheets[0]!;const cells:Cells={C5:excelDate(record.date),C6:record.responsible,C55:record.director,A57:record.observations};
 const map={weeding:[11,3,14,6,9],watering:[19,2,21,7,10],fertilization:[28,2,30,7,10],delivery:[34,4,38,7,10],seed:[41,3,44,6,9],transplant:[49,5,54,7,10]} as const;
 for(const g of record.groups){const [start,count,notes,treatment,observation]=map[g.id];cells[`B${notes}`]=[g.observations,g.fields?.map(f=>`${f.label}: ${f.value}`).join('\n')].filter(Boolean).join('\n');for(const c of g.criteria){if(c.index<0||c.index>=count)throw new Error('Criterio fuera del formato');const r=start+c.index;cells[`C${r}`]=c.status==='PASS'?'X':null;cells[`D${r}`]=c.status==='FAIL'?'X':null;cells[`E${r}`]=c.status==='NOT_APPLICABLE'?'X':null;['CORRECTION','RETURN','CONCESSION'].forEach((t,i)=>{cells[`${columns(treatment,3)[i]}${r}`]=c.treatments?.some(v=>v===t)?'X':null;});cells[`${columns(observation,1)[0]}${r}`]=c.observations;}}
 const fieldCells:Record<string,Record<string,string>>={watering:{'Cantidad de agua por planta':'C16'},fertilization:{'Cantidad por planta / unidad':'C23','Dosis':'G24','Producto':'C25','Plantas / cama fertilizadas':'J25'},delivery:{'Cantidad de plantas':'C31'}};
 for(const group of record.groups)for(const field of group.fields??[]){const target=fieldCells[group.id]?.[field.label]??(group.id==='transplant'&&field.label.toUpperCase().includes('CANTIDAD')?'C46':undefined);if(target)cells[target]=field.value;}
 return [{name:`monitoreo-${record.id}`,cells:{[s.path]:cells}}];
}
export function inventoryPages(sheets:SheetTemplate[],catalog:ManageableCatalogData,lines:readonly ManageableCatalogLine[]):ExportPage[]{
 const locations=new Map(catalog.locations.map(l=>[l.id,l]));
 const grouped=new Map<string,{sheet:SheetTemplate;rows:{line:ManageableCatalogLine;bed:string}[]}>();
 for(const line of lines){
  let loc=locations.get(line.locationId);let bed='';let module='';const seen=new Set<string>();
  while(loc&&!seen.has(loc.id)){seen.add(loc.id);if(loc.type==='CAMA')bed=loc.code.match(/\d+/)?.[0]??loc.displayName;
   if(['MODULO','GERMINADOR'].includes(loc.type))module=loc.type==='GERMINADOR'?'G'+(loc.code.match(/\d+/)?.[0]??''):'MODULO '+(loc.code.match(/\d+/)?.[0]??'');
   loc=loc.parentId?locations.get(loc.parentId):undefined;
  }
  // Reuse the original germinator layout on separate pages; never merge G2 and G3.
  const sheet=sheets.find(s=>s.name===module)??(/^G\d+$/.test(module)?sheets.find(s=>/^G\d+$/.test(s.name)):undefined);
  if(!sheet)throw new Error(`La ubicación de ${line.displayName} no existe en el formato original.`);
  const group=grouped.get(module)??{sheet,rows:[]};group.rows.push({line,bed});grouped.set(module,group);
 }
 const periods=[...new Set(lines.map(l=>l.inventory?.sourcePeriod).filter(Boolean))];
 const name=periods.length===1?`inventario-${periods[0]}`:'inventario';
 const pages:ExportPage[]=[];
 for(const [module,{sheet:s,rows}] of grouped)for(let offset=0;offset<rows.length;offset+=s.capacity!){
  const chunk=rows.slice(offset,offset+s.capacity!);const cells:Cells={};const first=s.column===1;
  const dateOf=(line:ManageableCatalogLine)=>line.inventory?.countedOn??line.inventory?.updatedAt;
  cells[first?'B6':'C5']=module;
  const dates=chunk.map(({line})=>dateOf(line)?.slice(0,10)).filter((v):v is string=>Boolean(v)).sort();
  cells[first?'D6':'E5']=excelDate(dates[0]);cells[first?'F6':'G5']=excelDate(dates.at(-1));
  cells[first?'H6':'I5']=[...new Set(chunk.map(({line})=>line.inventory?.actorDisplayName).filter(Boolean))].join(', ');
  chunk.forEach(({line,bed},i)=>row(cells,s.start!+i,[excelDate(dateOf(line)),bed,line.code.replace(/^L/i,''),line.inventory?.rootstocks,line.inventory?.females,line.inventory?.males,line.inventory?.initialDeadPlants,[line.inventory?.observations,line.inventory?.actorDisplayName?`Registrado por: ${line.inventory.actorDisplayName}`:'',!line.inventory?'Sin inventario registrado':''].filter(Boolean).join('\n')],s.column));
  for(let i=0;i<4;i++)cells[`${columns(s.column!+3,4)[i]}${s.totalRow}`]=chunk.reduce((n,{line})=>n+(line.inventory?.[(['rootstocks','females','males','initialDeadPlants'] as const)[i]!]??0),0);
  let page=pages.find(p=>!p.cells[s.path]);if(!page){page={name,cells:{}};pages.push(page);}page.cells[s.path]=cells;
 }
 return pages;
}
