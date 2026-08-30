import {useEffect, useMemo, useState} from "react";

import type {ManageableCatalogData, MonitorRepository, ProductionLotSummary} from "../domain/MonitorModels";

export function InventorySection({repository}: {readonly repository: MonitorRepository}) {
  const [catalog, setCatalog] = useState<ManageableCatalogData>({locations: [], lines: []});
  const [lots, setLots] = useState<readonly ProductionLotSummary[]>([]);
  const [lotFilter, setLotFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  useEffect(() => { void Promise.all([repository.listManageableCatalog(), repository.listManageableLots()]).then(([nextCatalog, nextLots]) => { setCatalog(nextCatalog); setLots(nextLots); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No fue posible cargar el inventario.")).finally(() => setLoading(false)); }, []);
  const lotByLine = useMemo(() => new Map(lots.flatMap((lot) => lot.lineIds.map((lineId) => [lineId, lot] as const))), [lots]);
  const lines = catalog.lines.filter((line) => {
    const lot = lotByLine.get(line.id);
    return line.active && (lotFilter === "ALL" || (lotFilter === "NONE" ? !lot : lot?.id === lotFilter)) && `${line.code} ${line.displayName} ${lot?.displayName ?? ""}`.toLowerCase().includes(search.toLowerCase());
  });
  const total = lines.reduce((sum, line) => sum + (line.inventory?.total ?? 0), 0);
  return <section className="inventory-admin" aria-labelledby="inventory-title"><div className="admin-dashboard__heading"><div><p className="eyebrow">DETALLE OFICIAL</p><h1 id="inventory-title">Inventario</h1><p>Consulta por línea y lote; no modifica existencias.</p></div><strong>{total.toLocaleString("es-CO")} plantas visibles</strong></div>{error && <p className="alert">{error}</p>}<div className="inventory-filters"><input aria-label="Buscar inventario" placeholder="Buscar línea o lote" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filtrar por lote" value={lotFilter} onChange={(event) => setLotFilter(event.target.value)}><option value="ALL">Todos los lotes</option><option value="NONE">Sin lote</option>{lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.displayName}</option>)}</select></div>{loading ? <p>Cargando…</p> : <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Línea</th><th>Lote</th><th>Hembras</th><th>Machos</th><th>Patrones</th><th>Total</th></tr></thead><tbody>{lines.map((line) => <tr key={line.id}><td><strong>{line.code}</strong><small>{line.displayName}</small></td><td>{lotByLine.get(line.id)?.displayName ?? "Sin lote"}</td><td>{line.inventory?.females.toLocaleString("es-CO") ?? "—"}</td><td>{line.inventory?.males.toLocaleString("es-CO") ?? "—"}</td><td>{line.inventory?.rootstocks.toLocaleString("es-CO") ?? "—"}</td><td><strong>{line.inventory?.total.toLocaleString("es-CO") ?? "Sin inicializar"}</strong></td></tr>)}</tbody></table></div>}</section>;
}
