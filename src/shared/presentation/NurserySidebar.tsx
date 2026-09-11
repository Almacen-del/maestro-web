import type {MonitorUser} from "../domain/MonitorModels";
import {nurseryModules, type NurseryModule} from "./NurseryModules";

export function NurserySidebar({user, collapsed, onToggle, onSignOut, activeModule, onModule}: {
  readonly user: MonitorUser; readonly collapsed: boolean; readonly onToggle: () => void;
  readonly onSignOut: () => void;
  readonly activeModule: NurseryModule; readonly onModule: (module: NurseryModule) => void;
}) {
  return <aside className="nursery-sidebar">
    <div className="nursery-brand"><img src="/logo-arles.jpeg" alt="Arles" /><div className="nursery-sidebar-copy"><strong>Arles S.A.S.</strong><span>Gestión de vivero</span></div></div>
    <button className="nursery-toggle" type="button" aria-label={collapsed ? "Expandir menú" : "Colapsar menú"} aria-expanded={!collapsed} onClick={onToggle}>☰</button>
    <nav aria-label="Secciones de Maestro">
      {user.canManageCatalog && nurseryModules.map(({id, label, icon}) => <button key={id} aria-label={label} title={label} className={`nursery-nav-item ${activeModule === id ? "nursery-nav-item--active" : ""}`} aria-current={activeModule === id ? "page" : undefined} onClick={() => onModule(id)} type="button"><span className="nursery-nav-icon" aria-hidden="true">{icon}</span><span className="nursery-sidebar-copy">{label}</span></button>)}
    </nav>
    <p className="nursery-sidebar__notice nursery-sidebar-copy">Gestión y seguimiento del vivero.</p>
    <div className="nursery-session nursery-sidebar-copy"><small>Sesión</small><strong>{user.displayName}</strong></div>
    <button className="nursery-logout" type="button" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={onSignOut}><span aria-hidden="true">↪</span><span className="nursery-sidebar-copy">Salir</span></button>
  </aside>;
}
