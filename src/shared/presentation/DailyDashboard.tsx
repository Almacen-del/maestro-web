import {useState, type ReactNode} from "react";
import type {DailyActivity} from "../domain/DailyActivityContract";
import {PercentBars} from "./PercentBars";
import {OfficialExport} from "./OfficialExport";
import {dailyPages} from "./officialExportMappings";
import "./daily-dashboard.css";
import "./daily-reference.css";

function frequencies(values:readonly string[]) {
  const counts=new Map<string,number>();
  values.forEach(value=>counts.set(value,(counts.get(value)??0)+1));
  return [...counts].sort((a,b)=>b[1]-a[1]);
}
function Bars({title,values}:{title:string;values:readonly (readonly [string,number])[]}) {
  const vertical=title==="Registros por fecha";
  const ordered=vertical?[...values].sort((a,b)=>a[0].localeCompare(b[0])):values;
  return <article className="daily-chart"><h2>{title}</h2><PercentBars values={ordered} vertical={vertical} unit={title.includes("colaborador")?"participaciones":"registros"} labelPrefix={title+": "}/></article>;
}
function Ring({title,values}:{title:string;values:readonly (readonly [string,number])[]}) {
  const colors=["#00a45a","#8ed29d","#f2cd51","#8caec7","#b5c8c0"];
  const grouped=values.length>5?[...values.slice(0,4),["Otras",values.slice(4).reduce((n,v)=>n+v[1],0)] as const]:values;
  const total=grouped.reduce((n,v)=>n+v[1],0);let offset=0;
  return <article className="daily-chart daily-ring-card"><h2>{title}</h2><div className="daily-ring-layout"><div className="daily-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="46" fill="none" stroke="#edf3ef" strokeWidth="16"/>{grouped.map(([name,value],i)=>{const length=total?value/total*100:0;const start=offset;offset+=length;return <circle key={name} cx="60" cy="60" r="46" pathLength="100" fill="none" stroke={colors[i]} strokeWidth="16" strokeDasharray={`${length} ${100-length}`} strokeDashoffset={-start} transform="rotate(-90 60 60)"/>;})}</svg><div><strong>{total||"—"}</strong><small>registros</small></div></div><ul>{grouped.map(([name,value],i)=><li key={name}><i style={{background:colors[i]}}/><span>{name}</span><strong>{value} · {total?Math.round(value/total*100):0}%</strong></li>)}</ul></div>{!total&&<small className="daily-chart-empty">Sin registros disponibles</small>}</article>;
}
export function DailyDashboard({activities,controls,status}:{activities:readonly DailyActivity[]|undefined;controls:ReactNode;status:ReactNode}) {
  const [activity,setActivity]=useState("");const [author,setAuthor]=useState("");const [search,setSearch]=useState("");const [page,setPage]=useState(0);const [detail,setDetail]=useState<DailyActivity>();
  const filtered=activities?.filter(r=>(!activity||r.title===activity)&&(!author||r.recordedByName===author)&&`${r.title} ${r.location} ${r.collaborators.join(" ")} ${r.notes}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  const rows=filtered??[];const currentPage=Math.min(page,Math.max(0,Math.ceil(rows.length/8)-1));
  const plantRows=rows.filter(r=>r.plants!==undefined);const plants=plantRows.reduce((n,r)=>n+(r.plants??0),0);
  const cards:[[string,string,string],... [string,string,string][]]=[
    ["▤","Registros recibidos",String(rows.length)], ["♧","Colaboradores",String(new Set(rows.flatMap(r=>r.collaborators)).size)],
    ["❧","Plantas registradas",plantRows.length?plants.toLocaleString("es-CO"):"—"], ["▦","Tipos de actividad",String(new Set(rows.map(r=>r.title)).size)],
    ["◉","Responsables",String(new Set(rows.map(r=>r.recordedByName).filter(Boolean)).size)], ["⌖","Ubicaciones registradas",String(new Set(rows.map(r=>r.location)).size)]
  ];
  return <section className="daily-dashboard" aria-labelledby="daily-title">
    <header className="daily-dashboard-heading"><div><small>ARLES S.A.S. · VIVERO</small><h1 id="daily-title">Procesos diarios</h1><p>Registros recibidos desde el celular.</p></div><OfficialExport kind="daily" disabled={!filtered?.length} build={sheets=>dailyPages(sheets,rows)}/></header>
    <div className="daily-dashboard-filters">{controls}<label>Actividad<select value={activity} onChange={e=>{setActivity(e.target.value);setPage(0);}}><option value="">Todas</option>{[...new Set(activities?.map(r=>r.title))].sort().map(v=><option key={v}>{v}</option>)}</select></label><label>Registrado por<select value={author} onChange={e=>{setAuthor(e.target.value);setPage(0);}}><option value="">Todos</option>{[...new Set(activities?.map(r=>r.recordedByName).filter((v):v is string=>Boolean(v)))].sort().map(v=><option key={v}>{v}</option>)}</select></label><label className="daily-search">Buscar<input type="search" placeholder="Actividad, ubicación o colaborador" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/></label></div>
    {status}
    <div className="daily-dashboard-kpis">{cards.map(([icon,label,value])=><article key={label}><span aria-hidden="true">{icon}</span><div><strong>{activities?value:"—"}</strong><small>{label}</small></div></article>)}</div>
    <div className="daily-dashboard-main"><article className="daily-registers"><header><h2>Registros recibidos</h2><small>{rows.length?`${currentPage*8+1}–${Math.min((currentPage+1)*8,rows.length)} de ${rows.length}`:"0 registros"}</small></header><div className="daily-table-scroll"><table><thead><tr>{["Fecha","Actividad","Ubicación","Colaboradores","Cantidad","Registrado por","Acciones"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.slice(currentPage*8,(currentPage+1)*8).map(r=><tr key={r.id}><td>{r.date.split("-").reverse().join("/")}</td><th scope="row">{r.title}</th><td>{r.location}</td><td>{r.collaborators.length}</td><td>{(r.quantity??r.plants)?.toLocaleString("es-CO")??"—"} {r.unit??(r.plants!==undefined?"plantas":"")}</td><td>{r.recordedByName??"No registrado"}</td><td><button type="button" onClick={()=>setDetail(r)}>Ver detalle<span className="daily-sr-only">: {r.title}</span></button></td></tr>)}</tbody></table></div>{activities&&!rows.length&&<p className="daily-no-results">No hay registros que coincidan con los filtros.</p>}<nav aria-label="Páginas de registros"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Anterior</button><button disabled={(currentPage+1)*8>=rows.length} onClick={()=>setPage(currentPage+1)}>Siguiente</button></nav></article><aside className="daily-dashboard-rings"><Ring title="Resumen de actividades" values={frequencies(rows.map(r=>r.title))}/><Ring title="Registros por responsable" values={frequencies(rows.map(r=>r.recordedByName??"Sin responsable"))}/></aside></div>
    <div className="daily-dashboard-bottom"><Bars title="Participaciones por colaborador" values={frequencies(rows.flatMap(r=>[...new Set(r.collaborators)]))}/><Bars title="Registros por fecha" values={frequencies(rows.map(r=>r.date))}/><Bars title="Registros por ubicación" values={frequencies(rows.map(r=>r.location))}/></div>
    <footer className="daily-dashboard-footer">❧ <span>Consulta y exporta los registros enviados desde el celular.<small>Las plantas registradas suman cantidades de actividades; una planta puede aparecer en varias labores. No es inventario ni producción única.</small></span></footer>
    {detail&&<div className="daily-detail-backdrop" onKeyDown={e=>{if(e.key==="Escape")setDetail(undefined);}}><section role="dialog" aria-modal="true" aria-label={`Detalle: ${detail.title}`} className="daily-detail"><button autoFocus type="button" onClick={()=>setDetail(undefined)}>Cerrar detalle</button><h2>{detail.title}</h2><p>{detail.date} · {detail.individualHours?"Horario individual":`${detail.start} – ${detail.end}`}</p><p>{detail.location}</p><p>Registrado por: {detail.recordedByName??"No registrado"}</p><h3>Colaboradores</h3><ul>{detail.collaborators.map((name,i)=><li key={`${name}-${i}`}>{name}</li>)}</ul>{detail.workerDetails?.map((w,i)=><p key={i}>{w.name} · {w.start}–{w.end}{w.quantity!==undefined?` · ${w.quantity} ${detail.unit??""}`:""}</p>)}<h3>Observaciones</h3><p>{detail.notes||"Sin observaciones registradas"}</p></section></div>}
  </section>;
}
