import type {MonitorUser} from "../domain/MonitorModels";

export function NurserySidebar({user, collapsed, onToggle, onHome, onSignOut}: {
  readonly user: MonitorUser; readonly collapsed: boolean; readonly onToggle: () => void;
  readonly onHome: () => void; readonly onSignOut: () => void;
}) {
  return <aside className="nursery-sidebar">
    <div className="nursery-brand"><img src="/logo-arles.jpeg" alt="Arles" /><div className="nursery-sidebar-copy"><strong>Arles S.A.S.</strong><span>Gestión de vivero</span></div></div>
    <button className="nursery-toggle" type="button" aria-label={collapsed ? "Expandir menú" : "Colapsar menú"} aria-expanded={!collapsed} onClick={onToggle}>☰</button>
    <nav aria-label="Secciones de Maestro">
      {user.canManageCatalog && <button aria-label="Menú principal" title="Menú principal" className="nursery-nav-item nursery-nav-item--active" aria-current="page" type="button" onClick={onHome}><span className="nursery-nav-icon" aria-hidden="true">⌂</span><span className="nursery-sidebar-copy">Menú principal</span></button>}
      {user.canManageCatalog && [["Mapa", "▦"], ["Inventario", "▤"], ["Conteos", "▥"]].map(([label, icon]) => <button key={label} aria-label={label} title={`${label} · En preparación`} className="nursery-nav-item" type="button" disabled><span className="nursery-nav-icon" aria-hidden="true">{icon}</span><span className="nursery-sidebar-copy">{label}<small>En preparación</small></span></button>)}
      {user.role === "ADMINISTRADOR" && <button aria-label="Administración" title="Administración · En preparación" className="nursery-nav-item" type="button" disabled><span className="nursery-nav-icon" aria-hidden="true">⚙</span><span className="nursery-sidebar-copy">Administración<small>En preparación</small></span></button>}
    </nav>
    <p className="nursery-sidebar__notice nursery-sidebar-copy">Estamos renovando las demás secciones. Tus datos y el mapa se conservan.</p>
    <div className="nursery-session nursery-sidebar-copy"><small>Sesión</small><strong>{user.displayName}</strong></div>
    <button className="nursery-logout" type="button" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={onSignOut}><span aria-hidden="true">↪</span><span className="nursery-sidebar-copy">Salir</span></button>
  </aside>;
}
