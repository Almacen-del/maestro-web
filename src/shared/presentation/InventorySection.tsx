import {useEffect, useMemo, useState} from "react";

import type {ManageableCatalogData, MonitorRepository} from "../domain/MonitorModels";

export function InventorySection({repository}: {readonly repository: MonitorRepository}) {
  const [catalog, setCatalog] = useState<ManageableCatalogData>({locations: [], lines: []});
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  useEffect(() => { void repository.listManageableCatalog().then(setCatalog).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No fue posible cargar el inventario.")).finally(() => setLoading(false)); }, [repository]);
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
  const modules = [...new Map(catalog.lines.filter((line) => line.active).flatMap((line) => {
    const module = moduleByLine.get(line.id);
    return module ? [[module.id, module] as const] : [];
  })).values()].sort((a, b) => a.displayName.localeCompare(b.displayName, "es", {numeric: true}));
  const lines = catalog.lines.filter((line) => {
    const module = moduleByLine.get(line.id);
    return line.active && (moduleFilter === "ALL" || (moduleFilter === "NONE" ? !module : module?.id === moduleFilter)) && `${line.code} ${line.displayName} ${module?.displayName ?? ""}`.toLowerCase().includes(search.toLowerCase());
  });
  const total = lines.reduce((sum, line) => sum + (line.inventory?.total ?? 0), 0);
  return <section className="inventory-admin" aria-labelledby="inventory-title"><div className="admin-dashboard__heading"><div><p className="eyebrow">DETALLE OFICIAL</p><h1 id="inventory-title">Inventario</h1><p>Consulta por línea y módulo; no modifica existencias.</p></div><strong>{total.toLocaleString("es-CO")} plantas visibles</strong></div>{error && <p className="alert">{error}</p>}<div className="inventory-filters"><input aria-label="Buscar inventario" placeholder="Buscar línea o módulo" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filtrar por módulo" value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}><option value="ALL">Todos los módulos</option><option value="NONE">Sin módulo</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.displayName}</option>)}</select></div>{loading ? <p>Cargando…</p> : <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Línea</th><th>Módulo</th><th>Hembras</th><th>Machos</th><th>Patrones</th><th>Total</th></tr></thead><tbody>{lines.map((line) => <tr key={line.id}><td><strong>{line.code}</strong><small>{line.displayName}</small></td><td>{moduleByLine.get(line.id)?.displayName ?? "Sin módulo"}</td><td>{line.inventory?.females.toLocaleString("es-CO") ?? "—"}</td><td>{line.inventory?.males.toLocaleString("es-CO") ?? "—"}</td><td>{line.inventory?.rootstocks.toLocaleString("es-CO") ?? "—"}</td><td><strong>{line.inventory?.total.toLocaleString("es-CO") ?? "Sin inicializar"}</strong></td></tr>)}</tbody></table></div>}</section>;
}
