import {DailyDashboard} from "./DailyDashboard";
import {useEffect, useState} from "react";
import type {MonitorRepository} from "../domain/MonitorModels";
import type {NurseryRepository} from "../domain/NurseryRepository";
import type {DailyActivity} from "../domain/DailyActivityContract";
export type {DailyActivity} from "../domain/DailyActivityContract";

export function DailyProcessesSection({activities: providedActivities, repository, dataRevision = 0}: {readonly activities?: readonly DailyActivity[]; readonly repository?: Pick<MonitorRepository, "listDailyActivities"> & Pick<NurseryRepository,"listNurseryRecords">; readonly dataRevision?: number}) {
  const [history,setHistory]=useState(false);
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [remote, setRemote] = useState<readonly DailyActivity[]>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const enabled = providedActivities === undefined && Boolean(history ? repository?.listNurseryRecords : repository?.listDailyActivities);
  const queryDate = history ? "" : date;
  useEffect(() => {
    if (!enabled || !repository) return;
    let active = true;
    setLoading(true); setError(false); setRemote(undefined);
    const request=history ? repository.listNurseryRecords!("DAILY").then(records=>records.activities) : repository.listDailyActivities!(queryDate);
    void request.then((value) => {if (active) setRemote(value);}).catch(() => {if (active) setError(true);}).finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [queryDate, history, enabled, repository, refresh, dataRevision]);
  const activities = enabled ? remote : providedActivities;
  const selected = activities?.filter((activity) => history ? (!from || activity.date>=from) && (!to || activity.date<=to) : activity.date===date).slice().sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  const status=loading?<p role="status">Cargando registros…</p>:error?<p role="alert">No fue posible consultar. Revisa la sesión, los permisos y la conexión.</p>:!activities?<p role="status"><strong>Conexión pendiente</strong> · La conexión con los procesos diarios del celular está pendiente.</p>:!selected?.length?<p role="status">{history ? "No hay actividades registradas para este período." : "No hay actividades registradas para esta fecha."}</p>:null;
  return <DailyDashboard key={`${history}-${queryDate}-${from}-${to}`} activities={selected} status={status} controls={<>
    {(repository?.listNurseryRecords || providedActivities) && <div role="group" aria-label="Vista de procesos"><button type="button" aria-pressed={!history} onClick={()=>{if(history){setHistory(false);setRemote(undefined);}}}>Por día</button><button type="button" aria-pressed={history} onClick={()=>{if(!history){setHistory(true);setRemote(undefined);}}}>Histórico</button></div>}
    {history ? <><label>Desde<input aria-label="Desde procesos" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta<input aria-label="Hasta procesos" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button type="button" onClick={()=>{setFrom("");setTo("");}}>Todas las fechas</button></> : <label>Fecha<input aria-label="Fecha de procesos" type="date" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/></label>}
    {enabled&&<button type="button" disabled={loading} onClick={()=>setRefresh(v=>v+1)}>Actualizar registros</button>}</>}/>;
}
