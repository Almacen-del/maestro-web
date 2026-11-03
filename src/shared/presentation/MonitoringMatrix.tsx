import {useState} from "react";
import {MonitoringDetail, monitoringTemplate, type MonitoringRecord} from "./MonitoringSection";
import "./monitoring-matrix.css";

const labels = {PASS: "Cumple", FAIL: "No cumple", NOT_APPLICABLE: "No aplica", UNASSESSED: "Sin evaluar"};
const treatments = {CORRECTION: "Corrección", RETURN: "Separación o devolución", CONCESSION: "Separación y autorización bajo concesión"};
export function MonitoringMatrix({records}: {readonly records?: readonly MonitoringRecord[]}) {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [process, setProcess] = useState("");
  const [result, setResult] = useState("");
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string>();
  const detail = records?.find(record => record.id === detailId);
  const rows = (records ?? []).filter(record => (!from || record.date >= from) && (!to || record.date <= to)).slice().sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).flatMap(record => monitoringTemplate.flatMap(group => {
    const saved = record.groups.find(item => item.id === group.id);
    return group.criteria.map((criterion, index) => ({record, group, saved, criterion, index, answer: saved?.criteria.find(item => item.index === index)}));
  })).filter(row => (!process || row.group.id === process) && (!result || (row.answer?.status ?? "UNASSESSED") === result) && `${row.record.responsible} ${row.record.id} ${row.group.title} ${row.criterion} ${row.answer?.observations ?? ""} ${row.saved?.observations ?? ""}`.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")));
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const current = Math.min(page, pages - 1);
  const change = (setter: (value: string) => void, value: string) => {setter(value); setPage(0);};
  if (detail) return <><button className="button button--secondary" onClick={() => setDetailId(undefined)}>← Volver a la matriz</button><MonitoringDetail records={[detail]}/></>;
  return <section className="monitoring-section monitoring-matrix" aria-labelledby="matrix-title">
    <header className="monitoring-heading"><div><p className="eyebrow">PV-F-010 · CONTROL DEL VIVERO</p><h1 id="matrix-title">Matriz de monitoreo</h1><p>Historial de criterios, resultados y observaciones por fecha y responsable.</p></div><span className="monitoring-mode">Solo consulta</span></header>
    <div className="monitoring-filters"><label>Buscar<input value={search} onChange={e => change(setSearch,e.target.value)} placeholder="Responsable, proceso, criterio…"/></label><label>Desde<input type="date" value={from} onChange={e => change(setFrom,e.target.value)}/></label><label>Hasta<input type="date" value={to} onChange={e => change(setTo,e.target.value)}/></label><label>Resultado<select value={result} onChange={e => change(setResult,e.target.value)}><option value="">Todos los resultados</option>{Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="button button--secondary" onClick={() => {setSearch("");setFrom("");setTo("");setProcess("");setResult("");setPage(0);}}>Limpiar filtros</button></div>
    <div className="matrix-counts" aria-label="Resumen de la matriz"><span><b>{new Set(rows.map(row => row.record.id)).size}</b> registros</span><span><b>{rows.length}</b> criterios filtrados</span><span><b>{rows.filter(row => row.answer?.status === "FAIL").length}</b> no cumplen</span><small>Una fila por criterio. Los criterios no registrados aparecen sin evaluar.</small></div>
    <div className="monitoring-unified"><div className="monitoring-process-buttons" role="group" aria-label="Elegir proceso"><button aria-pressed={!process} onClick={() => change(setProcess,"")}>Todos</button>{monitoringTemplate.map(group => <button key={group.id} aria-pressed={process === group.id} onClick={() => change(setProcess,group.id)}>{group.title}</button>)}</div>
    <div className="matrix-scroll"><table className="matrix-planilla"><caption>Planilla general de monitoreo</caption><thead><tr>{["Fecha / registro","Responsable","Proceso","Criterio de verificación","Resultado","Tratamiento","Observaciones / detalle"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.slice(current*25,current*25+25).map(row => <tr key={`${row.record.id}-${row.group.id}-${row.index}`}><td>{row.record.date.split("-").reverse().join("/")}<small>{row.record.id}</small></td><td>{row.record.responsible || "No registrado"}</td><td>{row.group.title}</td><td>{row.criterion}</td><td><span className={`monitoring-result monitoring-result--${row.answer?.status ?? "UNASSESSED"}`}>{labels[row.answer?.status ?? "UNASSESSED"]}</span></td><td>{row.answer?.status === "FAIL" ? row.answer.treatments?.map(item => treatments[item]).join(" · ") || "No registrado" : "—"}</td><td>{row.answer?.observations || "Sin observaciones"}<details><summary>Ver datos del proceso</summary>{row.saved?.fields?.map((field,i) => <p key={i}><b>{field.label}:</b> {field.value || "No registrado"}</p>)}<p><b>Observaciones del bloque:</b> {row.saved?.observations || "Sin observaciones"}</p><p><b>Director:</b> {row.record.director || "No registrado"}</p><p><b>Observaciones generales:</b> {row.record.observations || "Sin observaciones"}</p></details><button className="matrix-open" onClick={() => setDetailId(row.record.id)}>Ver registro / exportar</button></td></tr>)}</tbody></table></div>
    {!rows.length && <p className="monitoring-notice" role="status">{records === undefined ? "Conexión pendiente: no hay registros disponibles para la matriz." : "No hay monitoreos para estos filtros."}</p>}
    <footer className="matrix-pagination"><span>{rows.length ? current*25+1 : 0}–{Math.min((current+1)*25,rows.length)} de {rows.length} criterios · Página {current+1} de {pages}</span><button disabled={current===0} onClick={() => setPage(current-1)}>Anterior</button><button disabled={current+1>=pages} onClick={() => setPage(current+1)}>Siguiente</button></footer></div>
  </section>;
}
