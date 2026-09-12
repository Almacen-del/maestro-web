import {OfficialExport} from "./OfficialExport";
import {monitoringPages} from "./officialExportMappings";
import {useState} from "react";
import "./monitoring.css";

export const monitoringTemplate = [
  {id: "weeding", title: "Deshierbe y guadaña", criteria: ["Limpieza de la maleza en las bolsas", "Limpieza de los pasillos", "Limpieza de los alrededores de los módulos"]},
  {id: "watering", title: "Riego", criteria: ["Todas las plantas están regadas", "Cantidad y forma de riego según lo estipulado"]},
  {id: "fertilization", title: "Fertilización", criteria: ["Dilución o dosis según las especificaciones establecidas", "Aplicación del producto realizada correctamente"]},
  {id: "delivery", title: "Entrega de plantas", criteria: ["Plantas con tres pisos foliares", "Plantas sanas, sin malformaciones ni enfermedades", "Plantas identificadas según su género e injertadas", "Edad entre un año y dos meses y dos años"]},
  {id: "seed", title: "Selección de semilla", criteria: ["Fruta con tres lóbulos y no vana", "Fruta madura y sin cáscara", "Cuesco desinfectado con la dosificación estipulada"]},
  {id: "transplant", title: "Trasplante de plántulas", criteria: ["Raíz pivotante con estructura desarrollada", "Plántula sin enfermedades ni descomposición", "La plántula presenta cotiledones", "Bolsa de 6 pulgadas de ancho, 19 de alto y 1 de fuelle; 15 orificios laterales de 7 mm y uno inferior de 1 pulgada", "Siembra sin cavidades de aire, raíz cubierta y tierra al nivel del cuello de la plántula"]},
] as const;

export type MonitoringStatus = "PASS" | "FAIL" | "NOT_APPLICABLE" | "UNASSESSED";
type Treatment = "CORRECTION" | "RETURN" | "CONCESSION";
const statuses: Record<MonitoringStatus, string> = {PASS: "Cumple", FAIL: "No cumple", NOT_APPLICABLE: "No aplica", UNASSESSED: "Sin evaluar"};
const treatments: Record<Treatment, string> = {CORRECTION: "Corrección", RETURN: "Separación o devolución", CONCESSION: "Separación y autorización bajo concesión"};
const fieldLabels: Record<string, readonly string[]> = {
  watering: ["Cantidad de agua por planta"],
  fertilization: ["Cantidad por planta", "Tipo de fertilización", "Producto"],
  delivery: ["Cantidad de plantas"],
  transplant: ["Cantidad de trasplante (según formato de origen)"],
};

/** Read-only display contract. A mobile/remote adapter is still required. */
export interface MonitoringRecord {
  readonly id: string;
  readonly date: string;
  readonly responsible: string;
  readonly director?: string;
  readonly observations?: string;
  readonly groups: readonly {
    readonly id: typeof monitoringTemplate[number]["id"];
    readonly fields?: readonly {readonly label: string; readonly value: string}[];
    readonly observations?: string;
    readonly criteria: readonly {
      readonly index: number;
      readonly status: MonitoringStatus;
      readonly treatments?: readonly Treatment[];
      readonly observations?: string;
    }[];
  }[];
}

const dateLabel = (date: string) => date.split("-").reverse().join("/");

export function MonitoringSection({records}: {readonly records?: readonly MonitoringRecord[]}) {
  const [date, setDate] = useState("");
  const [responsible, setResponsible] = useState("");
  const [recordId, setRecordId] = useState("");
  const [status, setStatus] = useState<MonitoringStatus | "">("");
  const filtered = records?.filter((item) => (!date || item.date === date) && (!responsible || item.responsible === responsible)).slice().sort((a, b) => b.date.localeCompare(a.date));
  const selected = filtered?.find((item) => item.id === recordId) ?? filtered?.[0];
  const groups = monitoringTemplate.map((template) => {
    const saved = selected?.groups.find((group) => group.id === template.id);
    return {...template, saved, results: template.criteria.map((label, index) => ({label, index, result: saved?.criteria.find((criterion) => criterion.index === index)}))};
  });
  const all = groups.flatMap((group) => group.results);
  return <section className="monitoring-section" aria-labelledby="monitoring-title"><OfficialExport kind="monitoring" disabled={!(selected)} build={sheets => selected ? monitoringPages(sheets, selected) : []}/>
    <header className="monitoring-heading"><div><p className="eyebrow">PV-F-010 · CALIFICACIÓN DE CARACTERÍSTICAS</p><h1 id="monitoring-title">Monitoreo de vivero</h1><p>Evaluación diaria de los procesos y sus observaciones.</p></div><span className="monitoring-mode">{records === undefined ? "Vista previa · conexión pendiente" : "Solo consulta"}</span></header>
    <div className="monitoring-filters"><label>Fecha<input type="date" value={date} onChange={(event) => {setDate(event.target.value); setRecordId("");}} /></label><label>Responsable<select value={responsible} onChange={(event) => {setResponsible(event.target.value); setRecordId("");}}><option value="">Todos los responsables</option>{[...new Set(records?.map((item) => item.responsible).filter(Boolean))].sort().map((name) => <option key={name}>{name}</option>)}</select></label><label>Resultado<select value={status} onChange={(event) => setStatus(event.target.value as MonitoringStatus | "")}><option value="">Todos los resultados</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" className="button button--secondary" onClick={() => {setDate(""); setResponsible(""); setStatus(""); setRecordId("");}}>Limpiar filtros</button></div>
    {records === undefined && <p className="monitoring-notice" role="status">Formato sin diligenciar. Los cuatro archivos se usaron como referencia; no se importaron registros ni se interpretaron las marcas del Excel.</p>}
    {filtered && filtered.length > 0 && <label className="monitoring-record-picker">Registro a consultar<select value={selected?.id ?? ""} onChange={(event) => setRecordId(event.target.value)}>{filtered.map((item) => <option key={item.id} value={item.id}>{dateLabel(item.date)} · {item.responsible || "Responsable no registrado"} · {item.id}</option>)}</select></label>}
    {selected && <div className="monitoring-owner"><span>Fecha: <strong>{dateLabel(selected.date)}</strong></span><span>Responsable: <strong>{selected.responsible || "No registrado"}</strong></span></div>}
    <div className="monitoring-summary" aria-label="Resumen del registro completo">{Object.entries(statuses).map(([value, label]) => <article className={`monitoring-count monitoring-count--${value}`} key={value}><span>{label}</span><strong>{selected ? all.filter((item) => (item.result?.status ?? "UNASSESSED") === value).length : "—"}</strong></article>)}</div>
    {filtered?.length === 0 ? <p className="monitoring-notice" role="status">No hay monitoreos para estos filtros.</p> : <div className="monitoring-groups">{groups.map((group) => {
      const visible = group.results.filter((item) => !status || (item.result?.status ?? "UNASSESSED") === status);
      if (!visible.length) return null;
      return <details className="monitoring-group" key={group.id} open><summary><strong>{group.title}</strong><span>{visible.length} criterios</span></summary><div className="monitoring-group-content">
        {(group.saved?.fields?.length || fieldLabels[group.id]) && <dl className="monitoring-fields">{(group.saved?.fields?.length ? group.saved.fields : (fieldLabels[group.id] ?? []).map((label) => ({label, value: ""}))).map((field, index) => <div key={index}><dt>{field.label}</dt><dd>{field.value || "No registrado"}</dd></div>)}</dl>}
        <ul className="monitoring-criteria">{visible.map((item) => <li key={item.index}><div className="monitoring-criterion-heading"><span>{item.label}</span><span className={`monitoring-result monitoring-result--${item.result?.status ?? "UNASSESSED"}`}>{statuses[item.result?.status ?? "UNASSESSED"]}</span></div>{item.result?.status === "FAIL" && <p className="monitoring-treatment"><strong>Tratamiento: </strong>{item.result.treatments?.length ? item.result.treatments.map((treatment) => treatments[treatment]).join(" · ") : "No registrado"}</p>}{item.result?.observations && <p className="monitoring-remark">{item.result.observations}</p>}</li>)}</ul>
        <div className="monitoring-group-observations"><strong>Observaciones del bloque</strong><p>{group.saved?.observations || "Sin observaciones registradas"}</p></div>
      </div></details>;
    })}{status && !all.some((item) => (item.result?.status ?? "UNASSESSED") === status) && <p className="monitoring-notice">No hay criterios con este resultado.</p>}</div>}
    <footer className="monitoring-footer"><div><strong>Director de vivero</strong><p>{selected?.director || "No registrado"}</p><small>El nombre no sustituye una firma.</small></div><div><strong>Observaciones generales</strong><p>{selected?.observations || "Sin observaciones registradas"}</p></div></footer>
  </section>;
}
