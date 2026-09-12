import type {MonitorUser} from "../domain/MonitorModels";
import {nurseryModules, type NurseryModule} from "./NurseryModules";
import {NurseryIcon} from "./NurseryIcon";

export function NurserySidebar({user, collapsed, onToggle, onSignOut, activeModule, onModule}: {
  readonly user: MonitorUser; readonly collapsed: boolean; readonly onToggle: () => void;
  readonly onSignOut: () => void;
  readonly activeModule: NurseryModule; readonly onModule: (module: NurseryModule) => void;
}) {
  return <aside className="nursery-sidebar">
    <div className="nursery-brand"><img src="/logo-arles.jpeg" alt="Arles" /><div className="nursery-sidebar-copy"><strong>Arles S.A.S.</strong><span>Gestión de vivero</span></div></div>
    <button className="nursery-toggle" type="button" aria-label={collapsed ? "Expandir menú" : "Colapsar menú"} aria-expanded={!collapsed} onClick={onToggle}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={collapsed?"m9 6 6 6-6 6":"m15 6-6 6 6 6"}/></svg></button>
    <nav aria-label="Secciones de Maestro">
      {user.canManageCatalog && nurseryModules.map(({id, label}) => <button key={id} data-module={id} aria-label={label} title={label} className={`nursery-nav-item ${activeModule === id ? "nursery-nav-item--active" : ""}`} aria-current={activeModule === id ? "page" : undefined} onClick={() => onModule(id)} type="button"><span className="nursery-nav-icon"><NurseryIcon name={id}/></span><span className="nursery-sidebar-copy">{label}</span></button>)}
    </nav>
    <p className="nursery-sidebar__notice nursery-sidebar-copy">Gestión y seguimiento del vivero.</p>
    <div className="nursery-session nursery-sidebar-copy"><small>Sesión</small><strong>{user.displayName}</strong></div>
    <button className="nursery-logout" type="button" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={onSignOut}><span aria-hidden="true">↪</span><span className="nursery-sidebar-copy">Salir</span></button>
  </aside>;
}
