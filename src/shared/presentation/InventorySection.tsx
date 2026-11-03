import {OfficialExport} from "./OfficialExport";
import "./inventory-compact.css";
import {inventoryPages} from "./officialExportMappings";
import {useEffect, useMemo, useState} from "react";

import type {ManageableCatalogData, MonitorRepository} from "../domain/MonitorModels";

export function InventorySection({repository}: {readonly repository: MonitorRepository}) {
  const [catalog, setCatalog] = useState<ManageableCatalogData>({locations: [], lines: []});
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [bedFilter, setBedFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>();
  const load = (reuse = false) => {
    setLoading(true); setError(undefined);
    return repository.listManageableCatalog(reuse).then(setCatalog).catch(() => setError("No fue posible cargar el inventario. Intenta actualizar de nuevo.")).finally(() => setLoading(false));
  };
  useEffect(() => { let active = true; void repository.listManageableCatalog(true).then((value) => { if (active) setCatalog(value); }).catch(() => { if (active) setError("No fue posible cargar el inventario. Intenta actualizar de nuevo."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [repository]);
  const moduleByLine = useMemo(() => {
    const locations = new Map(catalog.locations.map((item) => [item.id, item]));
    return new Map(catalog.lines.map((line) => {
      let location = locations.get(line.locationId);
      const visited = new Set<string>();
      while (location && !visited.has(location.id)) {
        visited.add(location.id);
        if (location.type.toUpperCase().includes("MOD") || location.type.toUpperCase() === "GERMINADOR") return [line.id, location] as const;
        location = location.parentId ? locations.get(location.parentId) : undefined;
      }
      return [line.id, undefined] as const;
    }));
  }, [catalog]);
  const bedByLine = useMemo(() => {
    const locations = new Map(catalog.locations.map((item) => [item.id, item]));
    return new Map(catalog.lines.map((line) => {
      let location = locations.get(line.locationId);
      const visited = new Set<string>();
      while (location && !visited.has(location.id)) {
        visited.add(location.id);
        if (location.type.toUpperCase() === "CAMA") return [line.id, location] as const;
        location = location.parentId ? locations.get(location.parentId) : undefined;
      }
      return [line.id, undefined] as const;
    }));
  }, [catalog]);
  const beds = [...new Map(catalog.lines.filter((line) => line.active && moduleByLine.get(line.id)?.id === moduleFilter).flatMap((line) => {
    const bed = bedByLine.get(line.id);
    return bed ? [[bed.id, bed] as const] : [];
  })).values()].sort((a, b) => a.order - b.order || a.displayName.localeCompare(b.displayName, "es", {numeric: true}));
  const modules = [...new Map(catalog.lines.filter((line) => line.active).flatMap((line) => {
    const module = moduleByLine.get(line.id);
    return module ? [[module.id, module] as const] : [];
  })).values()].sort((a, b) => a.displayName.localeCompare(b.displayName, "es", {numeric: true}));
  const lines = catalog.lines.filter((line) => {
    const module = moduleByLine.get(line.id);
    return line.active && (bedFilter === "ALL" || bedByLine.get(line.id)?.id === bedFilter) && (moduleFilter === "ALL" || (moduleFilter === "NONE" ? !module : module?.id === moduleFilter)) && `${line.code} ${line.displayName} ${module?.displayName ?? ""}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => (moduleByLine.get(a.id)?.displayName ?? "").localeCompare(moduleByLine.get(b.id)?.displayName ?? "", "es", {numeric: true}) || (bedByLine.get(a.id)?.displayName ?? "").localeCompare(bedByLine.get(b.id)?.displayName ?? "", "es", {numeric: true}) || a.code.localeCompare(b.code, "es", {numeric: true}));
  const total = lines.reduce((sum, line) => sum + (line.inventory?.total ?? 0), 0);
  const registered = lines.filter((line) => line.inventory);
  const selected = catalog.lines.find((line) => line.id === selectedId);
  const sum = (field: "rootstocks" | "females" | "males") => registered.reduce((value, line) => value + (line.inventory?.[field] ?? 0), 0);
  const deadRecords = registered.filter((line) => line.inventory?.initialDeadPlants !== undefined);
  const latest = registered.map((line) => line.inventory?.updatedAt).filter((value): value is string => Boolean(value)).sort().at(-1);
  const displayDate = (value?: string) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString("es-CO") : "No disponible";
  const display = (value: number) => loading || error || !registered.length ? "—" : value.toLocaleString("es-CO");
  const distribution = [
    {label: "Patrones", value: sum("rootstocks"), color: "#287b55"},
    {label: "Hembras", value: sum("females"), color: "#74af87"},
    {label: "Machos", value: sum("males"), color: "#d7ad5b"},
  ];
  const distributionTotal = distribution.reduce((value, item) => value + item.value, 0);
  let angle = 0;
  const gradient = distribution.map(item => {
    const start = angle; angle += distributionTotal ? item.value / distributionTotal * 360 : 0;
    return `${item.color} ${start}deg ${angle}deg`;
  }).join(",");
  const moduleTotals = [...new Set(lines.map(line => moduleByLine.get(line.id)?.displayName ?? "Sin módulo"))].map(label => ({
    label, total: lines.filter(line => (moduleByLine.get(line.id)?.displayName ?? "Sin módulo") === label).reduce((value, line) => value + (line.inventory?.total ?? 0), 0),
  }));
  const pending = lines.filter(line => !line.inventory);
  return <section className="inventory-admin inventory-preview inventory-compact" aria-labelledby="inventory-title"><OfficialExport kind="inventory" disabled={!(lines.length && !loading && !error)} build={sheets => inventoryPages(sheets, catalog, lines)}/>
    <header className="inventory-preview-heading"><div><p className="eyebrow">EXISTENCIAS DEL VIVERO</p><h1 id="inventory-title">Inventario</h1><p>Consulta por módulo, cama y línea.</p></div><button className="button button--secondary" disabled={loading} onClick={() => void load()}>{loading ? "Actualizando…" : "Actualizar"}</button></header>
    {error && <p className="alert" role="alert">{error}</p>}
    <div className="inventory-summary-cards">
      {[{label: "Total de plantas vivas", value: total}, {label: "Patrones", value: sum("rootstocks")}, {label: "Hembras", value: sum("females")}, {label: "Machos", value: sum("males")}, {label: "Líneas registradas", value: registered.length}, {label: "Líneas sin inventario", value: lines.length - registered.length}].map(({label, value}) => <article key={label}><span>{label}</span><strong>{label.startsWith("Líneas") ? (loading || error ? "—" : value.toLocaleString("es-CO")) : display(value)}</strong><small>Según los filtros actuales</small></article>)}
    </div>
    {!loading && !error && <div className="inventory-coverage"><div><strong>{registered.length ? `${total.toLocaleString("es-CO")} plantas visibles` : "Sin existencias registradas"}</strong><span>Líneas con inventario: {registered.length} de {lines.length}{registered.length < lines.length ? " · Total parcial" : ""}</span></div><div><strong>Muertas · inventario inicial</strong><span>{deadRecords.length ? deadRecords.reduce((value, line) => value + (line.inventory?.initialDeadPlants ?? 0), 0).toLocaleString("es-CO") : "No disponible"}{deadRecords.length > 0 && deadRecords.length < lines.length ? " · Información parcial" : ""}</span></div></div>}
    <div className="inventory-analytics">
      <article className="inventory-chart"><h2>Plantas por ubicación</h2><p>Existencias vivas registradas · proporción del total visible</p><div className="inventory-module-bars">{!loading && !error && moduleTotals.map(item => <div key={item.label}><span>{item.label}</span><div className="inventory-bar-track"><i style={{width: `${total ? item.total / total * 100 : 0}%`}}/></div><strong>{item.total.toLocaleString("es-CO")} <small>({total ? Math.round(item.total / total * 100) : 0}%)</small></strong></div>)}{!loading && !error && !registered.length && <p>Sin existencias registradas para graficar.</p>}</div></article>
      <article className="inventory-chart"><h2>Composición del inventario</h2><p>Patrones, hembras y machos · plantas vivas</p><div className="inventory-composition"><div className="inventory-donut" style={{background: !loading && !error && distributionTotal ? `conic-gradient(${gradient})` : "#e7eeea"}}><span><strong>{display(distributionTotal)}</strong><small>plantas clasificadas</small></span></div><ul>{distribution.map(item => <li key={item.label}><i style={{background:item.color}}/><span>{item.label}</span><strong>{display(item.value)}</strong><small>{!loading && !error && distributionTotal ? Math.round(item.value / distributionTotal * 100) + "%" : "—"}</small></li>)}</ul></div></article>
    </div>
    <div className="inventory-workspace"><div className="inventory-stock-card"><h2>Existencias por línea</h2>
    <div className="inventory-filters"><input aria-label="Buscar inventario" placeholder="Buscar línea o módulo" value={search} onChange={(event) => setSearch(event.target.value)} /><div className="inventory-location-filters"><select aria-label="Filtrar por módulo" value={moduleFilter} onChange={(event) => { setModuleFilter(event.target.value); setBedFilter("ALL"); }}><option value="ALL">Todos los módulos</option><option value="NONE">Sin módulo</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.displayName}</option>)}</select>{beds.length > 0 && <div className="inventory-bed-buttons" role="group" aria-label="Filtrar por cama"><button type="button" className="button button--secondary" aria-pressed={bedFilter === "ALL"} onClick={() => setBedFilter("ALL")}>Todas las camas</button>{beds.map((bed) => <button type="button" key={bed.id} className="button button--secondary" aria-pressed={bedFilter === bed.id} onClick={() => setBedFilter(bed.id)}>{bed.displayName}</button>)}</div>}</div></div>
    <p className="inventory-source-note">Última actualización registrada: {displayDate(latest)}. Historial y fechas de conteo del celular pendientes de conexión.</p>
    {loading ? <p role="status">Cargando inventario…</p> : !error && <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Línea</th><th>Módulo</th><th>Cama</th><th>Patrones</th><th>Hembras</th><th>Machos</th><th>Vivas</th><th>Muertas (inicial)</th><th>Responsable del registro</th><th>Estado</th></tr></thead><tbody>{lines.map((line) => <tr key={line.id}><td><button type="button" className="inventory-line-link" aria-label={`Ver detalle de ${line.displayName}`} aria-expanded={selectedId === line.id} onClick={() => setSelectedId(line.id)}>{line.code}</button><small>{line.displayName}</small></td><td>{moduleByLine.get(line.id)?.displayName ?? "Sin módulo"}</td><td>{bedByLine.get(line.id)?.displayName ?? "Sin cama"}</td><td>{line.inventory?.rootstocks.toLocaleString("es-CO") ?? "—"}</td><td>{line.inventory?.females.toLocaleString("es-CO") ?? "—"}</td><td>{line.inventory?.males.toLocaleString("es-CO") ?? "—"}</td><td><strong>{line.inventory?.total.toLocaleString("es-CO") ?? "—"}</strong></td><td>{line.inventory?.initialDeadPlants?.toLocaleString("es-CO") ?? "—"}</td><td>{line.inventory?.actorDisplayName || "No disponible"}</td><td><span className={`inventory-state ${line.inventory ? "inventory-state--available" : ""}`}>{line.inventory ? "Registrada" : "Sin contar"}</span></td></tr>)}</tbody></table>{!lines.length && <p className="daily-empty">No hay líneas para estos filtros.</p>}</div>}
    </div><aside className="inventory-attention"><h2>Seguimiento del inventario</h2><p>Líneas pendientes de registro en la selección</p>{!loading && !error && <><strong className="inventory-pending-total">{pending.length} pendientes</strong>{pending.slice(0,5).map(line => <button key={line.id} onClick={() => setSelectedId(line.id)}><span>{line.code}<small>{moduleByLine.get(line.id)?.displayName ?? "Sin módulo"} · {bedByLine.get(line.id)?.displayName ?? "Sin cama"}</small></span><span aria-hidden="true">›</span></button>)}{!pending.length && <p className="inventory-complete">Todas las líneas visibles tienen inventario.</p>}{pending.length > 5 && <small>Y {pending.length - 5} líneas más en la tabla.</small>}</>}<p>Una línea registrada con cero plantas no es una línea pendiente.</p></aside></div>
    {selected && <aside className="inventory-line-detail" aria-labelledby="line-detail-title"><button type="button" className="button button--secondary" onClick={() => setSelectedId(undefined)}>Cerrar detalle</button><h2 id="line-detail-title">{selected.displayName}</h2><dl><dt>Responsable del registro</dt><dd>{selected.inventory?.actorDisplayName || "No disponible"}</dd><dt>Última actualización</dt><dd>{displayDate(selected.inventory?.updatedAt)}</dd><dt>Patrones / Hembras / Machos</dt><dd>{selected.inventory ? `${selected.inventory.rootstocks.toLocaleString("es-CO")} / ${selected.inventory.females.toLocaleString("es-CO")} / ${selected.inventory.males.toLocaleString("es-CO")}` : "Sin contar"}</dd><dt>Plantas vivas</dt><dd>{selected.inventory?.total.toLocaleString("es-CO") ?? "—"}</dd><dt>Muertas del inventario inicial</dt><dd>{selected.inventory?.initialDeadPlants?.toLocaleString("es-CO") ?? "No disponible"}</dd></dl><p>Observaciones y conteos anteriores aún no disponibles.</p></aside>}
  </section>;
}
