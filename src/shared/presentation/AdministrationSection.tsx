export type AdministrationDestination = "LOTS" | "USERS" | "CATALOG" | "MIGRATION";

const tools: readonly {destination: AdministrationDestination; title: string; description: string}[] = [
  {destination: "LOTS", title: "Lotes", description: "Crear cohortes de siembra y asignarles líneas."},
  {destination: "USERS", title: "Usuarios", description: "Administrar cuentas, roles y acceso."},
  {destination: "CATALOG", title: "Catálogo", description: "Gestionar ubicaciones, módulos, camas y líneas."},
  {destination: "MIGRATION", title: "Migración", description: "Validar paquetes antes de cualquier importación."},
];

export function AdministrationSection({onOpen}: {readonly onOpen: (destination: AdministrationDestination) => void}) {
  return <section className="administration-hub" aria-labelledby="administration-title"><div className="admin-dashboard__heading"><div><p className="eyebrow">CONFIGURACIÓN Y CONTROL</p><h1 id="administration-title">Administración</h1><p>Herramientas centrales separadas del análisis diario del vivero.</p></div></div><div className="administration-grid">{tools.map((tool) => <button type="button" key={tool.destination} onClick={() => onOpen(tool.destination)}><strong>{tool.title}</strong><span>{tool.description}</span><b>Abrir →</b></button>)}</div></section>;
}
