import {useState} from "react";

export interface DailyActivity {
  readonly id: string;
  readonly title: string;
  readonly date: string;
  readonly start: string;
  readonly end: string;
  readonly location: string;
  readonly collaborators: readonly string[];
  readonly plants?: number;
  readonly notes: string;
}

export function DailyProcessesSection({activities}: {readonly activities?: readonly DailyActivity[]}) {
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const selected = activities?.filter((activity) => activity.date === date);
  const collaborators = selected ? new Set(selected.flatMap((activity) => activity.collaborators)).size : undefined;
  return <section className="daily-processes" aria-labelledby="daily-title">
    <header className="daily-heading"><h1 id="daily-title">Procesos diarios {date.slice(0, 4)}</h1><span className="daily-status">{activities ? "Consulta" : "Conexión pendiente"}</span></header>
    <label className="daily-date">Fecha<input aria-label="Fecha de procesos" type="date" value={date} onChange={(event) => { if (event.target.value) setDate(event.target.value); }} /></label>
    <div className="daily-summary" aria-label="Resumen del día">
      <div><span aria-hidden="true">▣</span><strong>{selected?.length ?? "—"}</strong><small>Actividades</small></div>
      <div><span aria-hidden="true">♧</span><strong>{collaborators ?? "—"}</strong><small>Colaboradores</small></div>
      <div><span aria-hidden="true">♧</span><strong>—</strong><small>Plantas únicas</small></div>
      <div><span aria-hidden="true">◷</span><strong>—</strong><small>Horario del día</small></div>
    </div>
    <div className="daily-activities">
      {!activities ? <div className="daily-empty" role="status"><span aria-hidden="true">♧</span><h2>Registros desde el celular</h2><p>La conexión con los procesos diarios del celular está pendiente. Aquí aparecerán las actividades, responsables, ubicaciones y observaciones cuando esté disponible.</p></div> : !selected?.length ? <p className="daily-empty" role="status">No hay actividades registradas para esta fecha.</p> : selected.map((activity, index) => <details className="daily-card" key={activity.id} open>
        <summary><span className="daily-number">{index + 1}</span><strong>{activity.title}</strong></summary>
        <div className="daily-card-body"><p>◷ <span>{activity.start} – {activity.end}</span></p><p>⌖ <span>{activity.location}</span></p><p>♧ <span>{activity.collaborators.join(", ") || "Sin colaboradores registrados"}</span></p><p>♧ <span>{activity.plants === undefined ? "Cantidad no registrada" : `${activity.plants.toLocaleString("es-CO")} plantas`}</span></p><p>▤ <span>{activity.notes || "Sin observaciones registradas"}</span></p></div>
      </details>)}
    </div>
    <footer className="daily-footer"><div><strong>Total del día</strong><span>Sin consolidado disponible</span></div><div><strong>Observaciones generales</strong><span>{activities ? "Consulta las observaciones de cada actividad." : "Pendientes de sincronización desde el celular."}</span></div></footer>
  </section>;
}
