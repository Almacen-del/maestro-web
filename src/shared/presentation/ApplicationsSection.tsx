import {OfficialExport} from "./OfficialExport";
import {applicationPages} from "./officialExportMappings";
import {useState} from "react";
import "./applications.css";
import "./applications-agro.css";
import "./applications-compact.css";

/** Presentation contract only: no remote collection or Android API is assumed. */
export interface ApplicationRecord {
  readonly id: string;
  readonly date: string;
  readonly time?: string;
  readonly location: string;
  readonly beds?: string;
  readonly lines?: string;
  readonly product: string;
  readonly activeIngredient?: string;
  readonly dosePerLiter?: number | "NOT_APPLICABLE";
  readonly unit?: string;
  readonly waterLiters?: number | "NOT_APPLICABLE";
  readonly totalDose?: number | "NOT_APPLICABLE";
  readonly applicationType: string;
  readonly objective?: string;
  readonly executor: string;
  readonly recordedBy?: string;
  readonly observations?: string;
}

const quantity = (value: number | "NOT_APPLICABLE" | undefined, unit = "") =>
  value === "NOT_APPLICABLE" ? "No aplica" : value === undefined ? "No registrado" : `${value.toLocaleString("es-CO")} ${unit}`.trim();
const dateLabel = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").reverse().join("/") : "Fecha no disponible";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function ApplicationsSection({records}: {readonly records?: readonly ApplicationRecord[]}) {
  const [month, setMonth] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string>();
  const [limit, setLimit] = useState(10);
  const choices = (field: "location" | "applicationType") => [...new Set(records?.map((record) => record[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es", {numeric: true}));
  const selected = records?.filter((record) => (!month || record.date.startsWith(month)) && (!location || record.location === location) && (!type || record.applicationType === type) && normalize([record.product, record.activeIngredient, record.executor, record.beds, record.lines, record.objective, record.location, record.observations, record.recordedBy].join(" ")).includes(normalize(search))).slice().sort((a, b) => b.date.localeCompare(a.date));
  const summaries = [
    {label: "Registros de productos", value: selected?.length},
    {label: "Productos distintos", value: selected && new Set(selected.map((record) => normalize(record.product))).size},
    {label: "Ubicaciones", value: selected && new Set(selected.map((record) => record.location)).size},
    {label: "Ejecutores", value: selected && new Set(selected.map((record) => record.executor).filter(Boolean)).size},
    {label: "Tipos de aplicación", value: selected && new Set(selected.map(record => record.applicationType).filter(Boolean)).size},
    {label: "Con observaciones", value: selected?.filter(record => record.observations?.trim()).length},
  ];
  const counts = [...new Set(selected?.map(record => record.applicationType || "Sin tipo"))].map(label => ({label, count: selected?.filter(record => (record.applicationType || "Sin tipo") === label).length ?? 0}));
  const days = [...new Set(selected?.map(record => record.date))].sort().slice(-7).map(date => ({date, count: selected?.filter(record => record.date === date).length ?? 0}));
  const maxDay = Math.max(1,...days.map(day => day.count));
  const colors = ["#2b8164","#e3a247","#517ca1","#a18baf","#8caa6d"];
  let angle = 0;
  const segments = counts.map((item,index) => {const start = angle; angle += item.count / (selected?.length || 1) * 360; return `${colors[index % colors.length]} ${start}deg ${angle}deg`;});
  return <section className="applications-section agro-dashboard" aria-labelledby="applications-title"><OfficialExport kind="applications" disabled={!selected?.length} build={sheets => applicationPages(sheets, selected ?? [])}/>
    <header className="applications-heading"><div><p className="eyebrow">CUIDADO DEL VIVERO · PV-F-001</p><h1 id="applications-title">Control de aplicaciones</h1><p>Seguimiento de productos, dosis, objetivos y ejecutores del PV-F-001.</p></div><span className="applications-badge">{records === undefined ? "Conexión pendiente" : "Solo consulta"}</span></header>
    <div className="applications-summary" aria-label="Resumen de registros filtrados">{summaries.map((item,index) => <article key={item.label}><span>{item.label}<i aria-hidden="true">{["▤","✿","⌖","♧","◈","✎"][index]}</i></span><strong>{item.value?.toLocaleString("es-CO") ?? "—"}</strong><small>Según los filtros actuales</small></article>)}</div>
    <div className="agro-analytics"><article><h2>Aplicaciones por fecha</h2><p>Registros de productos en las últimas siete fechas</p><div className="agro-bars">{days.map(day => <div className="agro-bar-column" key={day.date}><b>{day.count}</b><div className="agro-bar-track"><div style={{height:`${day.count/maxDay*100}%`}}/></div><small>{dateLabel(day.date).slice(0,5)}</small></div>)}{!days.length && <p>Sin registros para graficar.</p>}</div></article><article><h2>Tipos de aplicación</h2><p>Distribución de registros, no cobertura de líneas</p><div className="agro-distribution"><div className="agro-donut" style={{background:segments.length ? `conic-gradient(${segments.join(",")})` : "#e7eeea"}}><span><strong>{selected?.length ?? "—"}</strong><small>registros</small></span></div><ul>{counts.map((item,index) => <li key={item.label}><i style={{background:colors[index % colors.length]}}/><span>{item.label}</span><b>{Math.round(item.count/(selected?.length || 1)*100)}%</b></li>)}</ul></div></article></div>
    <div className="applications-filters">
      <label>Mes<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
      <label>Módulo / germinador / jardín<select value={location} onChange={(event) => setLocation(event.target.value)}><option value="">Todas las ubicaciones</option>{choices("location").map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Tipo de aplicación<select value={type} onChange={(event) => setType(event.target.value)}><option value="">Todos los tipos</option>{choices("applicationType").map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="applications-search">Buscar<input type="search" placeholder="Producto, objetivo, ejecutor o ubicación" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <button className="button button--secondary" type="button" onClick={() => {setMonth(""); setLocation(""); setType(""); setSearch("");}}>Limpiar filtros</button>
    </div>
    <div className="agro-history"><h2>Historial de intervenciones</h2><p>Productos registrados y trazabilidad operativa</p><div className="agro-table-scroll"><table><thead><tr>{["Fecha / ubicación","Producto / objetivo","Ejecutor","Dosis / mezcla","Detalle"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{selected?.slice(0,limit).map(record => <tr key={record.id}><td><strong>{dateLabel(record.date)} · {record.time || "Hora no registrada"}</strong><small>{record.location}{record.beds ? ` · Camas ${record.beds}` : ""} {record.lines ? `· Líneas ${record.lines}` : ""}</small></td><td><strong>{record.product}</strong><small>{record.applicationType} · {record.objective || "Objetivo no registrado"}</small><small>{record.activeIngredient || "Ingrediente no registrado"}</small></td><td>{record.executor || "No registrado"}</td><td><strong>{quantity(record.dosePerLiter, record.unit ? `${record.unit}/L` : "")}</strong><small>Agua: {quantity(record.waterLiters,"L")}</small><small>Producto: {quantity(record.totalDose,record.unit)}</small></td><td><button aria-label={`Ver detalle ${record.id}`} aria-expanded={detailId === record.id} onClick={() => setDetailId(detailId === record.id ? undefined : record.id)}>Ver detalle ↗</button></td></tr>)}</tbody></table></div><footer><span>{Math.min(limit,selected?.length ?? 0)} de {selected?.length ?? 0} registros</span>{(selected?.length ?? 0)>limit && <button onClick={() => setLimit(limit+10)}>Mostrar 10 más</button>}</footer></div>
    <aside className="agro-detail-panel" aria-label="Detalle de la intervención"><div className="agro-detail-title"><h2>Detalle de la intervención</h2>{detailId && <button aria-label="Cerrar detalle" onClick={() => setDetailId(undefined)}>×</button>}</div>
    {records === undefined ? <div className="applications-empty" role="status"><h2>Aplicaciones registradas desde el celular</h2><p>La vista está preparada. Los registros aparecerán cuando se conecte la aplicación Android.</p><p>El Excel se usó como formato de referencia; su historial no se ha importado.</p></div> : selected?.length === 0 ? <p className="applications-empty" role="status">No hay registros para estos filtros.</p> : <div className="applications-list">{!selected?.some(record => record.id === detailId) && <p className="agro-detail-placeholder">Selecciona «Ver detalle» en el historial para consultar el producto, las dosis y las observaciones.</p>}{selected?.filter(record => record.id === detailId).map((record) => <details className="application-card" key={record.id} open>
      <summary><span className="application-date">{dateLabel(record.date)}<small>{record.time || "Hora no registrada"}</small></span><span className="application-product"><strong>{record.product}</strong><small>{record.location}{record.beds ? ` · Camas: ${record.beds}` : ""}{record.lines ? ` · Líneas: ${record.lines}` : ""}</small></span><span className="applications-badge">{record.applicationType || "Tipo no registrado"}</span><span className="application-executor">{record.executor || "Ejecutor no registrado"}</span></summary>
      <div className="application-detail"><dl>
        <div><dt>Fecha</dt><dd>{dateLabel(record.date)}</dd></div>
        <div><dt>Hora de aplicación</dt><dd>{record.time || "No registrado"}</dd></div>
        <div><dt>Módulo / germinador</dt><dd>{record.location || "No registrado"}</dd></div>
        <div><dt>Cama</dt><dd>{record.beds || "No registrado"}</dd></div>
        <div><dt>Línea</dt><dd>{record.lines || "No registrado"}</dd></div>
        <div><dt>Productos</dt><dd>{record.product}</dd></div>
        <div><dt>Unidad (ml/g)</dt><dd>{record.unit || "No registrado"}</dd></div>
        <div><dt>Tipo de aplicación</dt><dd>{record.applicationType || "No registrado"}</dd></div>
        <div><dt>Ingrediente activo</dt><dd>{record.activeIngredient || "No registrado"}</dd></div>
        <div><dt>Dosis por litro de agua</dt><dd>{quantity(record.dosePerLiter, record.unit ? `${record.unit}/L` : "")}</dd></div>
        <div><dt>Cantidad de agua</dt><dd>{quantity(record.waterLiters, "L")}</dd></div>
        <div><dt>Cantidad de producto en la mezcla</dt><dd>{quantity(record.totalDose, record.unit)}</dd></div>
        <div><dt>Objetivo del insumo</dt><dd>{record.objective || "No registrado"}</dd></div>
        <div><dt>Ejecutor de la aplicación</dt><dd>{record.executor || "No registrado"}</dd></div>
        <div><dt>Registrado por</dt><dd>{record.recordedBy || "No disponible"}</dd></div>
      </dl><div className="application-observations"><h3>Observaciones</h3><p>{record.observations || "Sin observaciones registradas"}</p></div></div>
    </details>)}</div>}
    </aside>
    <p className="applications-note">Cada registro corresponde a un producto. Los volúmenes de agua y las dosis se muestran por registro, sin sumar mezclas ni combinar unidades.</p>
  </section>;
}
