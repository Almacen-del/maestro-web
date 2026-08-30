import {useEffect, useMemo, useState} from "react";
import type {
  ManageableCatalogData,
  ManageableCatalogLine,
  ManageableCatalogLocation,
  MonitorRepository,
} from "../domain/MonitorModels";

interface DashboardSectionProps {
  readonly repository: MonitorRepository;
}

interface ModuleSummary {
  readonly name: string;
  readonly lines: number;
  readonly initialized: number;
  readonly females: number;
  readonly males: number;
  readonly rootstocks: number;
  readonly total: number;
}

function moduleForLine(
  line: ManageableCatalogLine,
  locations: ReadonlyMap<string, ManageableCatalogLocation>,
): string {
  let current = locations.get(line.locationId);
  let fallback = current?.displayName ?? "Ubicación sin identificar";
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    fallback = current.displayName;
    if (current.type.toLocaleUpperCase("es").includes("MOD")) return current.displayName;
    current = current.parentId ? locations.get(current.parentId) : undefined;
  }
  return fallback;
}

export function DashboardSection({repository}: DashboardSectionProps) {
  const [catalog, setCatalog] = useState<ManageableCatalogData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setCatalog(await repository.listManageableCatalog());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar el resumen administrativo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => {
    const lines = catalog?.lines.filter((line) => line.active) ?? [];
    const initialized = lines.filter((line) => line.inventory);
    const totals = initialized.reduce((result, line) => ({
      females: result.females + (line.inventory?.females ?? 0),
      males: result.males + (line.inventory?.males ?? 0),
      rootstocks: result.rootstocks + (line.inventory?.rootstocks ?? 0),
      total: result.total + (line.inventory?.total ?? 0),
    }), {females: 0, males: 0, rootstocks: 0, total: 0});

    const locations = new Map((catalog?.locations ?? []).map((location) => [location.id, location]));
    const modules = new Map<string, ModuleSummary>();
    for (const line of lines) {
      const name = moduleForLine(line, locations);
      const previous = modules.get(name) ?? {name, lines: 0, initialized: 0, females: 0, males: 0, rootstocks: 0, total: 0};
      modules.set(name, {
        name,
        lines: previous.lines + 1,
        initialized: previous.initialized + (line.inventory ? 1 : 0),
        females: previous.females + (line.inventory?.females ?? 0),
        males: previous.males + (line.inventory?.males ?? 0),
        rootstocks: previous.rootstocks + (line.inventory?.rootstocks ?? 0),
        total: previous.total + (line.inventory?.total ?? 0),
      });
    }
    return {
      lines: lines.length,
      initialized: initialized.length,
      pending: lines.length - initialized.length,
      ...totals,
      modules: [...modules.values()].sort((left, right) => left.name.localeCompare(right.name, "es", {numeric: true})),
    };
  }, [catalog]);

  return (
    <section className="admin-dashboard" aria-labelledby="dashboard-title">
      <div className="admin-dashboard__heading">
        <div>
          <p className="eyebrow">VISIÓN GENERAL</p>
          <h1 id="dashboard-title">Panel administrativo</h1>
          <p>Inventario consolidado del vivero, calculado desde las fotografías oficiales de cada línea.</p>
        </div>
        <button className="button button--secondary" type="button" disabled={loading} onClick={() => void load()}>
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {error && <p className="alert" role="alert">{error}</p>}
      {!error && (
        <>
          <div className="dashboard-kpis" aria-label="Indicadores principales">
            <article className="dashboard-kpi dashboard-kpi--primary"><span>Total de plantas</span><strong>{summary.total.toLocaleString("es-CO")}</strong><small>Inventario oficial vigente</small></article>
            <article className="dashboard-kpi"><span>Hembras</span><strong>{summary.females.toLocaleString("es-CO")}</strong></article>
            <article className="dashboard-kpi"><span>Machos</span><strong>{summary.males.toLocaleString("es-CO")}</strong></article>
            <article className="dashboard-kpi"><span>Patrones</span><strong>{summary.rootstocks.toLocaleString("es-CO")}</strong></article>
            <article className="dashboard-kpi"><span>Líneas con inventario</span><strong>{summary.initialized}<small> / {summary.lines}</small></strong></article>
            <article className={`dashboard-kpi${summary.pending ? " dashboard-kpi--warning" : ""}`}><span>Sin inicializar</span><strong>{summary.pending}</strong></article>
          </div>

          <div className="dashboard-layout">
            <section className="dashboard-panel" aria-labelledby="modules-summary-title">
              <div className="dashboard-panel__heading"><div><p className="eyebrow">DISTRIBUCIÓN</p><h2 id="modules-summary-title">Inventario por módulo</h2></div><span>{summary.modules.length} módulos</span></div>
              {summary.modules.length === 0 ? <p className="empty-state">No hay líneas activas para resumir.</p> : (
                <div className="module-summary-list">
                  {summary.modules.map((module) => (
                    <article className="module-summary-row" key={module.name}>
                      <div><strong>{module.name}</strong><span>{module.initialized} de {module.lines} líneas con inventario</span></div>
                      <dl>
                        <div><dt>Total</dt><dd>{module.total.toLocaleString("es-CO")}</dd></div>
                        <div><dt>Hembras</dt><dd>{module.females.toLocaleString("es-CO")}</dd></div>
                        <div><dt>Machos</dt><dd>{module.males.toLocaleString("es-CO")}</dd></div>
                        <div><dt>Patrones</dt><dd>{module.rootstocks.toLocaleString("es-CO")}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <aside className="dashboard-panel dashboard-lots" aria-labelledby="lots-title">
              <p className="eyebrow">NUEVA ESTRUCTURA</p>
              <h2 id="lots-title">Lotes productivos</h2>
              <p>Un lote será una camada de plantas sembradas en el mismo periodo. Podrá ocupar varias líneas o módulos, pero cada línea tendrá un solo lote activo.</p>
              <div className="dashboard-lots__pending"><strong>Configuración pendiente</strong><span>Los totales por lote aparecerán cuando se registre la fecha de siembra y se asignen las líneas.</span></div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
