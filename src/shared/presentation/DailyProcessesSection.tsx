import {OfficialExport} from "./OfficialExport";
import {dailyPages} from "./officialExportMappings";
import {useEffect, useState} from "react";
import type {MonitorRepository} from "../domain/MonitorModels";
import type {DailyActivity} from "../domain/DailyActivityContract";
export type {DailyActivity} from "../domain/DailyActivityContract";

export function DailyProcessesSection({activities: providedActivities, repository}: {readonly activities?: readonly DailyActivity[]; readonly repository?: MonitorRepository}) {
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [remote, setRemote] = useState<readonly DailyActivity[]>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const enabled = repository?.environment === "EMULATOR" && Boolean(repository.listDailyActivities);
  useEffect(() => {
    if (!enabled || !repository?.listDailyActivities) return;
    let active = true;
    setLoading(true); setError(false); setRemote(undefined);
    void repository.listDailyActivities(date).then((value) => {if (active) setRemote(value);}).catch(() => {if (active) setError(true);}).finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [date, enabled, repository, refresh]);
  const activities = enabled ? remote : providedActivities;
  const selected = activities?.filter((activity) => activity.date === date);
  const collaborators = selected ? new Set(selected.flatMap((activity) => activity.collaborators)).size : undefined;
  return <section className="daily-processes" aria-labelledby="daily-title"><OfficialExport kind="daily" disabled={!(selected)} build={sheets => dailyPages(sheets, selected ?? [])}/>
    <header className="daily-heading"><h1 id="daily-title">Procesos diarios {date.slice(0, 4)}</h1><span className="daily-status">{activities ? "Consulta" : "Conexión pendiente"}</span></header>
    <label className="daily-date">Fecha<input aria-label="Fecha de procesos" type="date" value={date} onChange={(event) => { if (event.target.value) setDate(event.target.value); }} /></label>
    {enabled && <button type="button" className="button button--secondary" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>Actualizar desde emulador</button>}
    <div className="daily-summary" aria-label="Resumen del día">
      <div><span aria-hidden="true">▣</span><strong>{selected?.length ?? "—"}</strong><small>Actividades</small></div>
      <div><span aria-hidden="true">♧</span><strong>{collaborators ?? "—"}</strong><small>Colaboradores</small></div>
      <div><span aria-hidden="true">♧</span><strong>—</strong><small>Plantas únicas</small></div>
      <div><span aria-hidden="true">◷</span><strong>—</strong><small>Horario del día</small></div>
    </div>
    <div className="daily-activities">
      {loading ? <p role="status">Cargando registros del emulador…</p> : error ? <p role="alert">No fue posible consultar. Revisa la sesión, los permisos y el emulador.</p> : !activities ? <div className="daily-empty" role="status"><span aria-hidden="true">♧</span><h2>Registros desde el celular</h2><p>La conexión con los procesos diarios del celular está pendiente. Aquí aparecerán las actividades, responsables, ubicaciones y observaciones cuando esté disponible.</p></div> : !selected?.length ? <p className="daily-empty" role="status">No hay actividades registradas para esta fecha.</p> : selected.map((activity, index) => <details className="daily-card" key={activity.id} open>
        <summary><span className="daily-number">{index + 1}</span><strong>{activity.title}</strong></summary>
        {activity.recordedByName && <p>Registrado por: {activity.recordedByName}</p>}
        <div className="daily-card-body"><p>◷ <span>{activity.individualHours ? "Horario individual por colaborador" : `${activity.start} – ${activity.end}`}</span></p><p>⌖ <span>{activity.location}</span></p><p>♧ <span>{activity.collaborators.join(", ") || "Sin colaboradores registrados"}</span></p><p>♧ <span>{activity.quantity !== undefined ? `${activity.quantity.toLocaleString("es-CO")} ${activity.unit ?? ""}` : activity.plants === undefined ? "Cantidad no registrada" : `${activity.plants.toLocaleString("es-CO")} plantas`}</span></p>{activity.workerDetails && <ul aria-label="Detalle por colaborador">{activity.workerDetails.map((worker, index) => <li key={index}>{worker.name}{activity.individualHours ? ` · ${worker.start} – ${worker.end}` : ""}{worker.quantity !== undefined ? ` · ${worker.quantity.toLocaleString("es-CO")} ${activity.unit ?? ""}` : ""}</li>)}</ul>}<p>▤ <span>{activity.notes || "Sin observaciones registradas"}</span></p></div>
      </details>)}
    </div>
    <footer className="daily-footer"><div><strong>Total del día</strong><span>Sin consolidado disponible</span></div><div><strong>Observaciones generales</strong><span>{activities ? "Consulta las observaciones de cada actividad." : "Pendientes de sincronización desde el celular."}</span></div></footer>
  </section>;
}
