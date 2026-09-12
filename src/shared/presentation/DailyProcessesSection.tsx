import {DailyDashboard} from "./DailyDashboard";
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
  const enabled = providedActivities === undefined && Boolean(repository?.listDailyActivities);
  useEffect(() => {
    if (!enabled || !repository?.listDailyActivities) return;
    let active = true;
    setLoading(true); setError(false); setRemote(undefined);
    void repository.listDailyActivities(date).then((value) => {if (active) setRemote(value);}).catch(() => {if (active) setError(true);}).finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [date, enabled, repository, refresh]);
  const activities = enabled ? remote : providedActivities;
  const selected = activities?.filter((activity) => activity.date === date);
  const status=loading?<p role="status">Cargando registros…</p>:error?<p role="alert">No fue posible consultar. Revisa la sesión, los permisos y la conexión.</p>:!activities?<p role="status"><strong>Conexión pendiente</strong> · La conexión con los procesos diarios del celular está pendiente.</p>:!selected?.length?<p role="status">No hay actividades registradas para esta fecha.</p>:null;
  return <DailyDashboard key={date} activities={selected} status={status} controls={<><label>Fecha<input aria-label="Fecha de procesos" type="date" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/></label>{enabled&&<button type="button" disabled={loading} onClick={()=>setRefresh(v=>v+1)}>Actualizar registros</button>}</>}/>;
}
