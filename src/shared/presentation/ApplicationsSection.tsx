import {OfficialExport} from "./OfficialExport";
import {applicationPages} from "./officialExportMappings";
import {useState} from "react";
import "./applications.css";

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
  const choices = (field: "location" | "applicationType") => [...new Set(records?.map((record) => record[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es", {numeric: true}));
  const selected = records?.filter((record) => (!month || record.date.startsWith(month)) && (!location || record.location === location) && (!type || record.applicationType === type) && normalize([record.product, record.activeIngredient, record.executor, record.beds, record.lines, record.objective].join(" ")).includes(normalize(search))).slice().sort((a, b) => b.date.localeCompare(a.date));
  const summaries = [
    {label: "Registros de productos", value: selected?.length},
    {label: "Productos distintos", value: selected && new Set(selected.map((record) => normalize(record.product))).size},
    {label: "Ubicaciones", value: selected && new Set(selected.map((record) => record.location)).size},
    {label: "Ejecutores", value: selected && new Set(selected.map((record) => record.executor).filter(Boolean)).size},
  ];
  return <section className="applications-section" aria-labelledby="applications-title"><OfficialExport kind="applications" disabled={!(selected)} build={sheets => applicationPages(sheets, selected ?? [])}/>
    <header className="applications-heading"><div><p className="eyebrow">CUIDADO DEL VIVERO · PV-F-001</p><h1 id="applications-title">Control de aplicaciones</h1><p>Productos, ubicaciones y responsables de cada registro.</p></div><span className="applications-badge">{records === undefined ? "Conexión pendiente" : "Solo consulta"}</span></header>
    <div className="applications-summary" aria-label="Resumen de registros filtrados">{summaries.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.value?.toLocaleString("es-CO") ?? "—"}</strong></article>)}</div>
    <div className="applications-filters">
      <label>Mes<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
      <label>Módulo / germinador / jardín<select value={location} onChange={(event) => setLocation(event.target.value)}><option value="">Todas las ubicaciones</option>{choices("location").map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Tipo de aplicación<select value={type} onChange={(event) => setType(event.target.value)}><option value="">Todos los tipos</option>{choices("applicationType").map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="applications-search">Buscar<input type="search" placeholder="Producto, ingrediente, ejecutor o línea" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <button className="button button--secondary" type="button" onClick={() => {setMonth(""); setLocation(""); setType(""); setSearch("");}}>Limpiar filtros</button>
    </div>
    {records === undefined ? <div className="applications-empty" role="status"><h2>Aplicaciones registradas desde el celular</h2><p>La vista está preparada. Los registros aparecerán cuando se conecte la aplicación Android.</p><p>El Excel se usó como formato de referencia; su historial no se ha importado.</p></div> : selected?.length === 0 ? <p className="applications-empty" role="status">No hay registros para estos filtros.</p> : <div className="applications-list">{selected?.map((record) => <details className="application-card" key={record.id}>
      <summary><span className="application-date">{dateLabel(record.date)}<small>{record.time || "Hora no registrada"}</small></span><span className="application-product"><strong>{record.product}</strong><small>{record.location}{record.beds ? ` · Camas: ${record.beds}` : ""}{record.lines ? ` · Líneas: ${record.lines}` : ""}</small></span><span className="applications-badge">{record.applicationType || "Tipo no registrado"}</span><span className="application-executor">{record.executor || "Ejecutor no registrado"}</span></summary>
      <div className="application-detail"><dl>
        <div><dt>Ingrediente activo</dt><dd>{record.activeIngredient || "No registrado"}</dd></div>
        <div><dt>Dosis por litro de agua</dt><dd>{quantity(record.dosePerLiter, record.unit ? `${record.unit}/L` : "")}</dd></div>
        <div><dt>Cantidad de agua</dt><dd>{quantity(record.waterLiters, "L")}</dd></div>
        <div><dt>Cantidad de producto en la mezcla</dt><dd>{quantity(record.totalDose, record.unit)}</dd></div>
        <div><dt>Objetivo del insumo</dt><dd>{record.objective || "No registrado"}</dd></div>
        <div><dt>Ejecutor de la aplicación</dt><dd>{record.executor || "No registrado"}</dd></div>
        <div><dt>Registrado por</dt><dd>{record.recordedBy || "No disponible"}</dd></div>
      </dl><div className="application-observations"><h3>Observaciones</h3><p>{record.observations || "Sin observaciones registradas"}</p></div></div>
    </details>)}</div>}
    <p className="applications-note">Cada registro corresponde a un producto. Los volúmenes de agua y las dosis se muestran por registro, sin sumar mezclas ni combinar unidades.</p>
  </section>;
}
