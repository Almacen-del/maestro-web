import {useEffect,useState} from "react";
import type {ManageableCatalogData,MonitorRepository} from "../domain/MonitorModels";
import type {DailyActivity} from "./DailyProcessesSection";
import type {ApplicationRecord} from "./ApplicationsSection";
import type {MonitoringRecord} from "./MonitoringSection";
import type {GraftingRecord} from "./GraftingSection";
import "./general-report.css";

interface Records {activities:readonly DailyActivity[];applications:readonly ApplicationRecord[];monitoring:readonly MonitoringRecord[];grafting:readonly GraftingRecord[]}
export function summarizeCatalog(catalog:ManageableCatalogData) {
  const locations=new Map(catalog.locations.map(location=>[location.id,location]));
  const groups=new Map<string,{name:string;lines:number;missing:number;empty:number;total:number;females:number;males:number;rootstocks:number}>();
  for(const line of catalog.lines.filter(line=>line.active)) {
    let location=locations.get(line.locationId);const visited=new Set<string>();
    while(location && !visited.has(location.id) && !["MODULO","GERMINADOR"].includes(location.type.toUpperCase())) {visited.add(location.id);location=location.parentId?locations.get(location.parentId):undefined;}
    const valid=location && ["MODULO","GERMINADOR"].includes(location.type.toUpperCase());
    const key=valid && location?location.id:"unknown";
    const group=groups.get(key)??{name:valid && location?location.displayName:"Sin módulo identificado",lines:0,missing:0,empty:0,total:0,females:0,males:0,rootstocks:0};
    group.lines++;
    if(!line.inventory) group.missing++;
    else {if(line.inventory.total===0)group.empty++;for(const field of ["total","females","males","rootstocks"] as const)group[field]+=line.inventory[field];}
    groups.set(key,group);
  }
  return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,"es",{numeric:true}));
}
export function GeneralReportSection({repository,records,demo=false}:{readonly repository:MonitorRepository;readonly records?:Records;readonly demo?:boolean}) {
  const [catalog,setCatalog]=useState<ManageableCatalogData>();const [error,setError]=useState(false);const [refresh,setRefresh]=useState(0);const [month,setMonth]=useState("");
  useEffect(()=>{let active=true;setCatalog(undefined);setError(false);void repository.listManageableCatalog(refresh===0).then(value=>{if(active)setCatalog(value);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[repository,refresh]);
  const groups=catalog?summarizeCatalog(catalog):[];
  const sum=(field:"total"|"females"|"males"|"rootstocks"|"lines"|"missing"|"empty")=>groups.reduce((total,row)=>total+row[field],0);
  const display=(value:number)=>catalog?value.toLocaleString("es-CO"):"—";
  const filtered=<T extends {date:string},>(items:readonly T[])=>items.filter(item=>!month||item.date.startsWith(month));
  const operations=records?{activities:filtered(records.activities),applications:filtered(records.applications),monitoring:filtered(records.monitoring),grafting:filtered(records.grafting)}:undefined;
  const cards=[{label:"Procesos diarios",value:operations?.activities.length},{label:"Aplicaciones",value:operations?.applications.length},{label:"Monitoreos",value:operations?.monitoring.length},{label:"Registros de injertos",value:operations?.grafting.filter(r=>r.formType==="PV_F008_INJERTACION").length},{label:"Registros de yemas",value:operations?.grafting.filter(r=>r.formType==="PV_F007_YEMAS").length}];
  const failures=operations?.monitoring.reduce((n,r)=>n+r.groups.reduce((a,g)=>a+g.criteria.filter(c=>c.status==="FAIL").length,0),0);
  const exportReport=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({demo,generatedAt:new Date().toISOString(),inventoryScope:"Inventario actual, no histórico",operationMonth:month||null,inventory:groups,operations:operations??null},null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=`${demo?"DEMO-":""}informe-general.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <section className="general-report" aria-labelledby="general-report-title">
    <header className="general-report-heading"><div><small>ARLES S.A.S. · {demo?"DEMOSTRACIÓN":"VIVERO"}</small><h1 id="general-report-title">Informe general</h1><p>Una mirada al inventario y a la actividad del vivero.</p></div><button type="button" onClick={()=>setRefresh(r=>r+1)}>Actualizar</button></header>
    {error?<p role="alert">No fue posible consultar el inventario. Intenta actualizar.</p>:!catalog?<p role="status">Consultando inventario…</p>:null}
    <h2>Inventario actual</h2><p>No cambia con el filtro de mes. Las cantidades corresponden a líneas activas con inventario registrado.</p>
    <div className="general-report-kpis">{([['total','Plantas vivas'],['females','Hembras'],['males','Machos'],['rootstocks','Patrones']] as const).map(([field,label])=><article key={field}><span>{label}</span><strong>{catalog && sum("lines")===sum("missing")?"—":display(sum(field))}</strong></article>)}</div>
    {catalog && <p>{sum("lines")} líneas activas · {sum("empty")} vacías · {sum("missing")} sin inventario registrado{sum("missing")>0?". Totales parciales: faltan líneas por registrar.":"."}</p>}
    <div className="general-report-overview">
    <div className="general-report-table"><table><caption>Distribución por módulo</caption><thead><tr>{["Módulo","Líneas","Hembras","Machos","Patrones","Total vivo","Sin registro"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{groups.map(row=><tr key={row.name}><th scope="row">{row.name}</th><td>{row.lines}</td>{(["females","males","rootstocks","total"] as const).map(key=><td key={key}>{row.lines===row.missing?"—":row[key].toLocaleString("es-CO")}</td>)}<td>{row.missing}</td></tr>)}</tbody></table></div>
    <aside className="general-report-distribution" aria-label="Resumen visual del inventario"><h2>Plantas por módulo</h2>{groups.map(row=><div className="general-report-bar" key={row.name}><span>{row.name}</span><strong>{row.lines===row.missing?"—":row.total.toLocaleString("es-CO")}</strong><meter min={0} max={Math.max(1,...groups.map(g=>g.total))} value={row.total} aria-label={`Plantas en ${row.name}`}/></div>)}{!catalog && <p>Esperando inventario.</p>}<small>Existencias registradas; no representa productividad.</small></aside>
    </div>
    <div className="general-report-period"><h2>Actividad registrada</h2><label>Mes de actividad <input aria-label="Mes de actividad" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><button type="button" onClick={()=>setMonth("")}>Todos los meses</button></div>
    {!records && <p>La conexión productiva de estos registros está pendiente. No se muestran ceros como si no hubiera actividad.</p>}
    <div className="general-report-kpis">{cards.map(card=><article key={card.label}><span>{card.label}</span><strong>{card.value??"—"}</strong></article>)}</div>
    {operations && <p>{failures} criterios de monitoreo marcados «No cumple» en el período. Son observaciones registradas, no un diagnóstico ni casos únicos.</p>}
    <footer><button disabled={!catalog} type="button" onClick={exportReport}>Descargar informe JSON</button><small>Descarga de datos; no reemplaza los formatos oficiales de Excel/Drive.</small></footer>
  </section>;
}
