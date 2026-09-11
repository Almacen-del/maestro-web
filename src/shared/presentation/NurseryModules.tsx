export const nurseryModules = [
  {id: "HOME", label: "Menú principal", icon: "⌂"},
  {id: "DAILY", label: "Procesos diarios", icon: "▣"},
  {id: "MONITORING", label: "Monitoreo", icon: "◉"},
  {id: "APPLICATIONS", label: "Control de aplicaciones", icon: "♧"},
  {id: "INVENTORY", label: "Inventario", icon: "▤"},
  {id: "GRAFTING", label: "Injertación", icon: "⑂"},
  {id: "MAPS", label: "Mapas", icon: "▦"},
  {id: "GENERAL_REPORT", label: "Informe general", icon: "▧"},
] as const;

export type NurseryModule = typeof nurseryModules[number]["id"];

export function PendingNurseryModule({module}: {readonly module: NurseryModule}) {
  const definition = nurseryModules.find((entry) => entry.id === module)!;
  return <section className="daily-processes" aria-labelledby="pending-module-title">
    <header className="daily-heading"><h1 id="pending-module-title">{definition.label}</h1></header>
    <div className="daily-activities"><div className="daily-empty" role="status">
      <span aria-hidden="true">{definition.icon}</span>
      <h2>En preparación</h2>
      <p>Esta sección se adecuará al formato correspondiente.</p>
    </div></div>
  </section>;
}
