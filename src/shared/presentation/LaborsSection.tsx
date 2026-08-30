const laborTypes = ["Fumigación", "Fertilización", "Riego", "Mantenimiento"];

export function LaborsSection() {
  return <section className="labors-section" aria-labelledby="labors-title"><div className="admin-dashboard__heading"><div><p className="eyebrow">TRAZABILIDAD AGRONÓMICA</p><h1 id="labors-title">Labores</h1><p>Seguimiento futuro de actividades realizadas por lote y línea.</p></div></div><div className="labor-warning"><strong>Sin información central disponible</strong><span>No se mostrarán fumigaciones o fertilizaciones inventadas. Primero se definirá quién registra cada labor, productos, dosis, responsables y evidencias.</span></div><div className="labor-cards">{laborTypes.map((type) => <article key={type}><span>PRÓXIMA ETAPA</span><h2>{type}</h2><p>Modelo operativo y captura pendientes de aprobación.</p></article>)}</div></section>;
}
