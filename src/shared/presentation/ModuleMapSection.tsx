import {useEffect, useMemo, useState} from "react";
import type {MonitorJourney, MonitorLine, MonitorSnapshot} from "../domain/MonitorModels";

interface ModuleMapSectionProps {
  readonly snapshot?: MonitorSnapshot;
  readonly loading: boolean;
  readonly journeys?: readonly MonitorJourney[];
  readonly selectedJourneyId?: string;
  readonly onSelectJourney?: (journeyId: string) => void;
}

type VisualState = "completed" | "working" | "pending";

function numericOrder(value: string): number {
  const match = value.match(/\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(",", ".")) : Number.NEGATIVE_INFINITY;
}

function visualState(line: MonitorLine): VisualState {
  if (line.state === "APROBADA") return "completed";
  if (line.state === "EN_CONTEO" || line.state === "PENDIENTE_REVISION") return "working";
  return "pending";
}

function visualLabel(line: MonitorLine): string {
  const state = visualState(line);
  return state === "completed" ? "Realizada" : state === "working" ? "En proceso" : "Pendiente";
}

function moduleName(line: MonitorLine): string {
  return line.location.module.trim() || "Módulo sin nombre";
}

export function ModuleMapSection({snapshot, loading, journeys = [], selectedJourneyId, onSelectJourney}: ModuleMapSectionProps) {
  const modules = useMemo(() => {
    const grouped = new Map<string, MonitorLine[]>();
    for (const line of snapshot?.lines ?? []) {
      const name = moduleName(line);
      grouped.set(name, [...(grouped.get(name) ?? []), line]);
    }
    return [...grouped.entries()].sort(([left], [right]) =>
      left.localeCompare(right, "es", {numeric: true}),
    );
  }, [snapshot]);
  const [selectedModule, setSelectedModule] = useState<string>();
  const [selectedLine, setSelectedLine] = useState<MonitorLine>();

  useEffect(() => {
    if (!modules.length) {
      setSelectedModule(undefined);
      setSelectedLine(undefined);
      return;
    }
    if (!selectedModule || !modules.some(([name]) => name === selectedModule)) {
      setSelectedModule(modules[0]?.[0]);
      setSelectedLine(undefined);
    }
  }, [modules, selectedModule]);

  const lines = modules.find(([name]) => name === selectedModule)?.[1] ?? [];
  const beds = useMemo(() => {
    const grouped = new Map<string, MonitorLine[]>();
    for (const line of lines) {
      const bed = line.location.bed.trim() || "Cama sin nombre";
      grouped.set(bed, [...(grouped.get(bed) ?? []), line]);
    }
    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "es", {numeric: true}))
      .map(([name, bedLines]) => [name, [...bedLines].sort((left, right) =>
        numericOrder(right.location.line) - numericOrder(left.location.line) ||
        right.location.order - left.location.order,
      )] as const);
  }, [lines]);

  const completed = lines.filter((line) => visualState(line) === "completed").length;
  const working = lines.filter((line) => visualState(line) === "working").length;
  const pending = lines.length - completed - working;

  return (
    <section className="module-map" aria-labelledby="module-map-title">
      <div className="module-map__heading">
        <div>
          <p className="eyebrow">Plano operativo</p>
          <h1 id="module-map-title">Mapa de módulos</h1>
          <p>{snapshot ? `${snapshot.journeyDisplayName} · actualización en tiempo real` : "Seleccione una jornada activa en Conteos."}</p>
        </div>
        <div className="module-map__selectors">
          {journeys.length > 0 && onSelectJourney && (
            <label>
              Jornada activa
              <select value={selectedJourneyId ?? ""} onChange={(event) => event.target.value && onSelectJourney(event.target.value)}>
                <option value="">Seleccionar jornada</option>
                {journeys.map((journey) => <option key={journey.id} value={journey.id}>{journey.displayName}</option>)}
              </select>
            </label>
          )}
          {modules.length > 0 && (
            <label>
              Módulo
              <select value={selectedModule ?? ""} onChange={(event) => {
                setSelectedModule(event.target.value);
                setSelectedLine(undefined);
              }}>
                {modules.map(([name, moduleLines]) => <option key={name} value={name}>{name} · {moduleLines.length} líneas</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      {loading && <p className="empty-state">Cargando plano…</p>}
      {!loading && !snapshot && <p className="empty-state">Seleccione una jornada activa para ver su mapa.</p>}
      {!loading && snapshot && modules.length === 0 && <p className="empty-state">La jornada no contiene líneas para representar.</p>}

      {lines.length > 0 && (
        <>
          <div className="module-map__summary" aria-label="Resumen del módulo">
            <span><i className="map-dot map-dot--completed" />{completed} realizadas</span>
            <span><i className="map-dot map-dot--working" />{working} en proceso</span>
            <span><i className="map-dot map-dot--pending" />{pending} pendientes o devueltas</span>
          </div>
          <div className="module-map__layout">
            <div className="module-plan" aria-label={`Plano de ${selectedModule ?? "módulo"}`}>
              <div className="module-plan__north" aria-hidden="true">N ↑</div>
              <div className="module-plan__gate">ACCESO</div>
              <div className="module-plan__beds" style={{gridTemplateColumns: `repeat(${Math.max(beds.length, 1)}, minmax(170px, 1fr))`}}>
                {beds.map(([bed, bedLines], index) => (
                  <div className="module-bed" key={bed}>
                    <h2>{bed}</h2>
                    <div className="module-bed__lines">
                      {bedLines.map((line) => {
                        const state = visualState(line);
                        return (
                          <button
                            key={line.id}
                            type="button"
                            className={`module-line module-line--${state}${selectedLine?.id === line.id ? " module-line--selected" : ""}`}
                            aria-label={`${line.location.displayName}: ${visualLabel(line)}`}
                            title={`${line.location.displayName} · ${visualLabel(line)}`}
                            onClick={() => setSelectedLine(line)}
                          >
                            <span>{line.location.line}</span>
                          </button>
                        );
                      })}
                    </div>
                    {index < beds.length - 1 && <span className="module-plan__corridor" aria-hidden="true">CORREDOR</span>}
                  </div>
                ))}
              </div>
              <div className="module-plan__gate">ACCESO</div>
            </div>

            <aside className="module-line-detail" aria-live="polite">
              {!selectedLine ? (
                <div className="module-line-detail__empty">
                  <strong>Seleccione una línea</strong>
                  <span>Pulse una barra del plano para consultar sus datos.</span>
                </div>
              ) : (
                <>
                  <div className="module-line-detail__heading">
                    <div>
                      <small>{selectedLine.location.nursery} · {selectedLine.location.module} · {selectedLine.location.bed}</small>
                      <h2>{selectedLine.location.line}</h2>
                    </div>
                    <span className={`map-state map-state--${visualState(selectedLine)}`}>{visualLabel(selectedLine)}</span>
                  </div>
                  <dl className="module-line-detail__values">
                    <div><dt>Hembras</dt><dd>{selectedLine.count?.females ?? selectedLine.inventory?.females ?? "Sin dato"}</dd></div>
                    <div><dt>Machos</dt><dd>{selectedLine.count?.males ?? selectedLine.inventory?.males ?? "Sin dato"}</dd></div>
                    <div><dt>Patrones</dt><dd>{selectedLine.count?.rootstocks ?? selectedLine.inventory?.rootstocks ?? "Sin dato"}</dd></div>
                    <div><dt>Total vivo</dt><dd>{selectedLine.count?.total ?? selectedLine.inventory?.total ?? "Sin dato"}</dd></div>
                    <div><dt>Plantas muertas</dt><dd>{selectedLine.count?.deadPlants ?? "No registrado"}</dd></div>
                    <div><dt>Estado central</dt><dd>{selectedLine.state}</dd></div>
                  </dl>
                  {selectedLine.count?.observations && <p className="module-line-detail__observations"><strong>Observaciones</strong>{selectedLine.count.observations}</p>}
                  <p className="module-line-detail__source">
                    {selectedLine.count ? `Conteo vigente · versión ${selectedLine.count.version}` : selectedLine.inventory ? `Inventario oficial · versión ${selectedLine.inventory.version}` : "Aún no hay conteo ni inventario disponible."}
                  </p>
                </>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
