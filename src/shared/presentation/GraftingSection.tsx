import {OfficialExport} from "./OfficialExport";
import {graftPages} from "./officialExportMappings";
import {useState} from "react";
import "./grafting.css";

type Assessment = {readonly status?: "C" | "NC" | "N.A" | null; readonly treatment?: string; readonly notes?: string};
export interface GraftSample {
  readonly id: string; readonly sampleNumber: number; readonly module: string; readonly bed: string; readonly line: string;
  readonly treeAge?: string; readonly stemThicknessMm?: number | null; readonly healthyCondition?: "C" | "NC" | "N.A" | null;
  readonly notes?: string; readonly ncTreatment?: string;
  readonly rootstockCriteria?: readonly Assessment[];
  readonly graftCriteria?: readonly Assessment[];
  readonly graftNotes?: string; readonly graftNcTreatment?: string;
}
export interface BudCollection {
  readonly id: string; readonly collectionDate: string; readonly lot: string; readonly line: string;
  readonly gender: string; readonly motherTree: string; readonly yemaQuantity?: number | null;
  readonly notes?: string; readonly criteria?: readonly Assessment[];
}
export interface GraftingRecord {
  readonly id: string; readonly formType: "PV_F008_INJERTACION" | "PV_F007_YEMAS";
  readonly date: string; readonly responsible: string; readonly notes?: string;
  readonly totalGraftsCount?: number | null; readonly evaluatedSamplesCount?: number | null;
  readonly samples: readonly GraftSample[]; readonly yemaCollections: readonly BudCollection[];
}

const rootstockLabels = ["Edad del árbol (9 meses)", "Patrón acorde al tamaño de las yemas", "Plantas en condiciones sanas"];
const graftLabels = ["Yema acorde al grosor del patrón", "Injerto cubierto con la cintelita", "Corte de la yema diagonal en forma de bisel"];
const budLabels = ["Árbol sin síntomas de deshidratación", "Árbol sin signos de plagas y enfermedades", "Árbol con edad productiva mayor a dos años"];
const labels = {C: "Cumple", NC: "No cumple", "N.A": "No aplica"};
const number = (value?: number | null) => value == null ? "—" : value.toLocaleString("es-CO");
const dateLabel = (value: string) => value ? value.split("-").reverse().join("/") : "No registrada";
const shown = (value?: string) => value?.trim() || "No registrado";

function Criteria({title, criteriaLabels, values}: {readonly title: string; readonly criteriaLabels: readonly string[]; readonly values?: readonly Assessment[]}) {
  return <section className="grafting-criteria"><h3>{title}</h3><ul>{criteriaLabels.map((label, index) => {
    const value = values?.[index];
    return <li key={label}><div><span>{label}</span><span className={`grafting-result grafting-result--${value?.status ?? "PENDING"}`}>{value?.status ? labels[value.status] : "Sin evaluar"}</span></div>{value?.treatment && <p>Tratamiento: {value.treatment}</p>}{value?.notes && <p>{value.notes}</p>}</li>;
  })}</ul></section>;
}

export function GraftingSection({records}: {readonly records?: readonly GraftingRecord[]}) {
  const [tab, setTab] = useState<GraftingRecord["formType"]>("PV_F008_INJERTACION");
  const [month, setMonth] = useState("");
  const [responsible, setResponsible] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const filtered = records?.filter((record) => record.formType === tab && (!month || record.date.startsWith(month)) && (!responsible || record.responsible === responsible)).slice().sort((a, b) => b.date.localeCompare(a.date));
  const selected = filtered?.find((record) => record.id === selectedId) ?? filtered?.[0];
  const grafts = tab === "PV_F008_INJERTACION";
  const includes = (value: string) => value.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"));
  const samples = selected?.samples.filter((sample) => includes([sample.module, sample.bed, sample.line, sample.sampleNumber].join(" ")));
  const buds = selected?.yemaCollections.filter((bud) => includes([bud.lot, bud.line, bud.motherTree, bud.gender].join(" ")));
  const budTotal = selected && selected.yemaCollections.every((bud) => bud.yemaQuantity != null) ? selected.yemaCollections.reduce((sum, bud) => sum + (bud.yemaQuantity ?? 0), 0) : undefined;
  const summary = grafts ? [
    {label: "Injertaciones declaradas", value: selected?.totalGraftsCount},
    {label: "Muestras a evaluar", value: selected?.evaluatedSamplesCount},
    {label: "Muestras registradas", value: selected?.samples.length},
  ] : [
    {label: "Yemas del registro", value: budTotal},
    {label: "Recolecciones", value: selected?.yemaCollections.length},
    {label: "Árboles madre identificados", value: selected && new Set(selected.yemaCollections.filter((bud) => bud.lot && bud.line && bud.motherTree).map((bud) => JSON.stringify([bud.lot, bud.line, bud.motherTree]))).size},
  ];
  return <section className="grafting-section" aria-labelledby="grafting-title"><OfficialExport kind={tab === "PV_F008_INJERTACION" ? "grafts" : "buds"} disabled={!(selected)} build={sheets => selected ? graftPages(sheets, selected) : []}/>
    <header className="grafting-heading"><div><p className="eyebrow">TRAZABILIDAD DEL VIVERO</p><h1 id="grafting-title">Injertación</h1><p>{grafts ? "Verificación de patrones e injertos · PV-F-008" : "Recolección y verificación de yemas · PV-F-007"}</p></div><span className="grafting-mode">{records === undefined ? "Conexión pendiente" : "Solo consulta"}</span></header>
    <div className="grafting-tabs" role="group" aria-label="Tipo de formato"><button type="button" aria-pressed={grafts} onClick={() => {setTab("PV_F008_INJERTACION"); setSelectedId(""); setSearch("");}}>Injertos</button><button type="button" aria-pressed={!grafts} onClick={() => {setTab("PV_F007_YEMAS"); setSelectedId(""); setSearch("");}}>Yemas</button></div>
    <div className="grafting-filters"><label>Mes del registro<input type="month" value={month} onChange={(event) => {setMonth(event.target.value); setSelectedId("");}} /></label><label>Responsable<select value={responsible} onChange={(event) => {setResponsible(event.target.value); setSelectedId("");}}><option value="">Todos</option>{[...new Set(records?.map((record) => record.responsible).filter(Boolean))].sort().map((name) => <option key={name}>{name}</option>)}</select></label><label>Buscar en el detalle<input type="search" placeholder={grafts ? "Módulo, cama, línea o muestra" : "Lote de procedencia, línea o árbol madre"} value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="button button--secondary" onClick={() => {setMonth(""); setResponsible(""); setSearch(""); setSelectedId("");}}>Limpiar filtros</button></div>
    {filtered && filtered.length > 0 && <label className="grafting-record-picker">Registro<select value={selected?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}>{filtered.map((record) => <option value={record.id} key={record.id}>{dateLabel(record.date)} · {shown(record.responsible)} · {record.id}</option>)}</select></label>}
    {selected && <p>Fecha: <strong>{dateLabel(selected.date)}</strong> · Responsable: <strong>{shown(selected.responsible)}</strong></p>}
    <div className="grafting-summary" aria-label="Totales del registro completo">{summary.map((item) => <article key={item.label}><span>{item.label}</span><strong>{number(item.value)}</strong></article>)}</div>
    {records === undefined ? <p className="grafting-empty" role="status">Aquí aparecerán los registros sincronizados desde el celular.</p> : !selected ? <p className="grafting-empty" role="status">No hay registros para estos filtros.</p> : grafts ? <div className="grafting-list">{samples?.map((sample) => <details className="grafting-card" key={sample.id}><summary><strong>Muestra {sample.sampleNumber}</strong><span>Módulo {shown(sample.module)} · Cama {shown(sample.bed)} · Línea {shown(sample.line)}</span></summary><div className="grafting-card-body"><p>Edad registrada: {shown(sample.treeAge)}{sample.stemThicknessMm != null ? ` · Grosor registrado: ${number(sample.stemThicknessMm)} mm` : ""}</p><div className="grafting-criteria-grid"><Criteria title="Planta patrón" criteriaLabels={rootstockLabels} values={rootstockLabels.map((_, index) => sample.rootstockCriteria?.[index] ?? (index === 2 ? {status: sample.healthyCondition} : {}))} /><Criteria title="Injerto" criteriaLabels={graftLabels} values={sample.graftCriteria} /></div><div className="grafting-notes-grid"><div><h3>Observaciones del patrón</h3><p>{sample.notes || "Sin observaciones"}</p><p>Tratamiento NC: {shown(sample.ncTreatment)}</p></div><div><h3>Observaciones del injerto</h3><p>{sample.graftNotes || "Sin observaciones"}</p><p>Tratamiento NC: {shown(sample.graftNcTreatment)}</p></div></div></div></details>)}{!samples?.length && <p className="grafting-empty">No hay muestras para esta búsqueda.</p>}</div> : <div className="grafting-list">{buds?.map((bud) => <details className="grafting-card" key={bud.id}><summary><strong>Árbol madre {shown(bud.motherTree)}</strong><span>Lote de procedencia {shown(bud.lot)} · Línea {shown(bud.line)}</span><strong>{number(bud.yemaQuantity)} yemas</strong></summary><div className="grafting-card-body"><p>Recolección: {dateLabel(bud.collectionDate)} · Género: {bud.gender === "H" ? "Hembra" : bud.gender === "M" ? "Macho" : "No registrado"}</p><Criteria title="Verificación del árbol madre" criteriaLabels={budLabels} values={bud.criteria} /><h3>Observaciones de la recolección</h3><p>{bud.notes || "Sin observaciones"}</p></div></details>)}{!buds?.length && <p className="grafting-empty">No hay recolecciones para esta búsqueda.</p>}</div>}
    {!selected && records === undefined && <div className="grafting-template"><h2>Criterios del formato</h2><div className="grafting-criteria-grid">{grafts ? <><Criteria title="Planta patrón" criteriaLabels={rootstockLabels} /><Criteria title="Injerto" criteriaLabels={graftLabels} /></> : <Criteria title="Árbol madre" criteriaLabels={budLabels} />}</div></div>}
    {selected && <div className="grafting-general-notes"><h3>Observaciones generales</h3><p>{selected.notes || "Sin observaciones"}</p></div>}
    <details className="grafting-reference"><summary>Consultar criterios y tratamientos del formato</summary><p>C: Cumple · NC: No cumple · N.A: No aplica. Un campo sin registrar no equivale a cumplimiento.</p><ol><li>Corrección.</li><li>Separación.</li><li>Contención.</li><li>Devolución o suspensión de provisión de productos y servicios.</li><li>Información al cliente.</li><li>Obtención de autorización para aceptación bajo concesión.</li></ol>{grafts && <p>El formato recibido indica 10 muestras para 1–200 injertaciones, 25 para 201–500, 100 para 1.001–2.000 y 150 para 2.001–3.000. No se calcula automáticamente el tamaño de muestra: falta el rango 501–1.000 y no hay rango definido por encima de 3.000.</p>}</details>
  </section>;
}
