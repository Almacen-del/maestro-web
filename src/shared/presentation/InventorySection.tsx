import {useEffect, useMemo, useState} from "react";

import type {ManageableCatalogData, MonitorRepository} from "../domain/MonitorModels";

export function InventorySection({repository}: {readonly repository: MonitorRepository}) {
  const [catalog, setCatalog] = useState<ManageableCatalogData>({locations: [], lines: []});
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [bedFilter, setBedFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  useEffect(() => { void repository.listManageableCatalog(true).then(setCatalog).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No fue posible cargar el inventario.")).finally(() => setLoading(false)); }, [repository]);
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
  return <section className="inventory-admin" aria-labelledby="inventory-title"><div className="admin-dashboard__heading"><div><p className="eyebrow">DETALLE OFICIAL</p><h1 id="inventory-title">Inventario</h1><p>Consulta por línea y módulo; no modifica existencias.</p></div><strong>{total.toLocaleString("es-CO")} plantas visibles</strong></div>{error && <p className="alert">{error}</p>}<div className="inventory-filters"><input aria-label="Buscar inventario" placeholder="Buscar línea o módulo" value={search} onChange={(event) => setSearch(event.target.value)} /><div className="inventory-location-filters"><select aria-label="Filtrar por módulo" value={moduleFilter} onChange={(event) => { setModuleFilter(event.target.value); setBedFilter("ALL"); }}><option value="ALL">Todos los módulos</option><option value="NONE">Sin módulo</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.displayName}</option>)}</select>{beds.length > 0 && <div className="inventory-bed-buttons" role="group" aria-label="Filtrar por cama"><button type="button" className="button button--secondary" aria-pressed={bedFilter === "ALL"} onClick={() => setBedFilter("ALL")}>Todas las camas</button>{beds.map((bed) => <button type="button" key={bed.id} className="button button--secondary" aria-pressed={bedFilter === bed.id} onClick={() => setBedFilter(bed.id)}>{bed.displayName}</button>)}</div>}</div></div>{loading ? <p>Cargando…</p> : <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Línea</th><th>Módulo</th><th>Cama</th><th>Hembras</th><th>Machos</th><th>Patrones</th><th>Total</th></tr></thead><tbody>{lines.map((line) => <tr key={line.id}><td><strong>{line.code}</strong><small>{line.displayName}</small></td><td>{moduleByLine.get(line.id)?.displayName ?? "Sin módulo"}</td><td>{bedByLine.get(line.id)?.displayName ?? "Sin cama"}</td><td>{line.inventory?.females.toLocaleString("es-CO") ?? "—"}</td><td>{line.inventory?.males.toLocaleString("es-CO") ?? "—"}</td><td>{line.inventory?.rootstocks.toLocaleString("es-CO") ?? "—"}</td><td><strong>{line.inventory?.total.toLocaleString("es-CO") ?? "Sin inicializar"}</strong></td></tr>)}</tbody></table></div>}</section>;
}
