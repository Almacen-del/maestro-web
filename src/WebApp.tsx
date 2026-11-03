import {useEffect, useState, type FormEvent} from "react";
import type {MonitorUser} from "./shared/domain/MonitorModels";
import type {DocumentKind, NurseryRecords, NurseryRepository} from "./shared/domain/NurseryRepository";
import {NurserySidebar} from "./shared/presentation/NurserySidebar";
import {NurseryHomeSection} from "./shared/presentation/NurseryHomeSection";
import {DailyProcessesSection} from "./shared/presentation/DailyProcessesSection";
import {ApplicationsSection} from "./shared/presentation/ApplicationsSection";
import {MonitoringSection} from "./shared/presentation/MonitoringSection";
import {GraftingSection} from "./shared/presentation/GraftingSection";
import {InventorySection} from "./shared/presentation/InventorySection";
import {ModuleMapSection} from "./shared/presentation/ModuleMapSection";
import {GeneralReportSection} from "./shared/presentation/GeneralReportSection";
import type {NurseryModule} from "./shared/presentation/NurseryModules";
import "./web.css";
import "./shared/presentation/app.css";
import "./shared/presentation/report-refresh.css";
import "./shared/presentation/module-reference.css";
import "./shared/presentation/sidebar-refresh.css";
import "./shared/presentation/module-color-theme.css";

function ConnectedRecords({repository, module, dataRevision}: {repository: NurseryRepository; module: NurseryModule; dataRevision: number}) {
  const [records,setRecords] = useState<NurseryRecords>();
  const [error,setError] = useState("");
  const [refresh,setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setError(""); setRecords(undefined);
    const kind: DocumentKind | undefined = module === "GENERAL_REPORT" ? undefined : module as DocumentKind;
    if (!repository.listNurseryRecords) {setError("La fuente operativa no está configurada."); return;}
    void repository.listNurseryRecords(kind).then(value=>{if(active)setRecords(value);})
      .catch(()=>{if(active)setError("No fue posible consultar los registros. Revisa tu conexión y vuelve a intentar.");});
    return () => {active=false;};
  },[repository,module,refresh,dataRevision]);
  return <><div className="nursery-data-toolbar"><span>Registros de Vivero · Supabase</span><button type="button" onClick={()=>setRefresh(value=>value+1)}>Actualizar registros</button></div>
    {error ? <p className="alert" role="alert">{error}</p> : !records ? <p role="status">Cargando registros…</p>
      : module==="APPLICATIONS" ? <ApplicationsSection records={records.applications}/>
      : module==="MONITORING" ? <MonitoringSection records={records.monitoring}/>
      : module==="GRAFTING" ? <GraftingSection records={records.grafting}/>
      : <GeneralReportSection repository={repository} records={records}/>}
  </>;
}

export function WebApp({repository,configurationError}: {
  readonly repository: NurseryRepository; readonly configurationError?: string;
}) {
  const [user,setUser] = useState<MonitorUser>();
  const [restoring,setRestoring] = useState(Boolean(repository.restoreSession));
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [collapsed,setCollapsed] = useState(false);
  const [module,setModule] = useState<NurseryModule>("HOME");
  const [dataRevision,setDataRevision] = useState(0);
  useEffect(() => {
    if (!user) return;
    return repository.observeDataChanges?.(()=>setDataRevision(value=>value+1));
  },[repository,user]);
  useEffect(() => {
    let active = true;
    if (!repository.restoreSession) return;
    void repository.restoreSession().then(value=>{if(active)setUser(value);})
      .catch((reason:unknown)=>{if(active)setError(reason instanceof Error?reason.message:"No fue posible restaurar la sesión.");})
      .finally(()=>{if(active)setRestoring(false);});
    return () => {active=false;};
  },[repository]);
  useEffect(() => {
    if (!user) return;
    return repository.observeAccountStatus(user.id,active=>{
      if (!active) {setUser(undefined);setModule("HOME");setError("Sesión cerrada o cuenta sin acceso a Vivero.");}
    },setError);
  },[repository,user]);
  const signIn = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true);setError("");
    try {setUser(await repository.signIn(email,password));setPassword("");setModule("HOME");}
    catch (reason) {setError(reason instanceof Error?reason.message:"No fue posible ingresar.");}
    finally {setBusy(false);}
  };
  const signOut = async () => {
    try {await repository.signOut();setUser(undefined);setModule("HOME");setError("");}
    catch {setError("No fue posible cerrar la sesión. Intenta de nuevo.");}
  };
  return <main className={user?`app-shell nursery-shell${collapsed?" nursery-shell--collapsed":""}`:"app-shell"}>
    {configurationError && <p className="web-configuration-error" role="alert">{configurationError}</p>}
    {restoring ? <section className="nursery-session-loading" role="status" aria-live="polite"><img src="/logo-arles.jpeg" alt="Arles"/><h1>Vivero</h1><p>Restaurando sesión…</p></section>
      : !user ? <>
        <header className="nursery-access-brand"><div><img src="/logo-arles.jpeg" alt="Arles"/><div><strong>Vivero Maestro</strong><small>Propagación de material vegetal</small></div></div></header>
        <section className="login-panel" aria-labelledby="login-title"><p className="eyebrow">ARLES · VIVERO</p><h1 id="login-title">Acceso a Vivero</h1><p>Ingresa con tu cuenta autorizada de Supabase.</p>
          <form onSubmit={event=>void signIn(event)}><label>Correo<input autoComplete="username" type="email" required value={email} onChange={event=>setEmail(event.target.value)}/></label>
            <label>Contraseña<input autoComplete="current-password" type="password" required value={password} onChange={event=>setPassword(event.target.value)}/></label>
            {error && <p className="alert" role="alert">{error}</p>}<button className="button" disabled={busy||repository.environment==="DISABLED"}>{busy?"Ingresando…":"Iniciar sesión"}</button>
          </form></section></>
      : <><NurserySidebar user={user} collapsed={collapsed} onToggle={()=>setCollapsed(value=>!value)} activeModule={module} onModule={setModule} onSignOut={()=>void signOut()}/>
        {error && <p className="alert" role="alert">{error}</p>}
        {module==="HOME" ? <NurseryHomeSection repository={repository} dataRevision={dataRevision}/>
          : module==="DAILY" ? <DailyProcessesSection repository={repository} dataRevision={dataRevision}/>
          : module==="INVENTORY" ? <InventorySection repository={repository} dataRevision={dataRevision}/>
          : module==="MAPS" ? <ModuleMapSection repository={repository} loading={false} dataRevision={dataRevision}/>
          : <ConnectedRecords key={module} repository={repository} module={module} dataRevision={dataRevision}/>}
      </>}
  </main>;
}
