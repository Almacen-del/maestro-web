import {useEffect, useState} from "react";
import type {ManageableCatalogData, MonitorRepository} from "../domain/MonitorModels";

const stages = ["Germinación", "Trasplante", "Patrón", "Búsqueda de yema", "Injertos", "Plantas de cacay"];

function PhotoSpace({number, label}: {readonly number: number; readonly label: string}) {
  return <figure className={`nursery-photo nursery-photo--${number}`}><span aria-hidden="true">✳</span><figcaption><small>FOTOGRAFÍA {number} · POR INCORPORAR</small><strong>{label}</strong><p>Espacio reservado para una fotografía real del vivero.</p></figcaption></figure>;
}

export function NurseryHomeSection({repository}: {readonly repository: MonitorRepository}) {
  const [catalog, setCatalog] = useState<ManageableCatalogData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const load = async (reuse = false) => {
    setLoading(true);
    setError(undefined);
    try { setCatalog(await repository.listManageableCatalog(reuse)); }
    catch { setError("No fue posible consultar el inventario. Intenta actualizar de nuevo."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(true); }, []);
  const lines = catalog?.lines.filter((line) => line.active) ?? [];
  const total = lines.reduce((sum, line) => sum + (line.inventory?.total ?? 0), 0);
  const pending = lines.filter((line) => !line.inventory).length;
  return <section className="nursery-home" aria-labelledby="nursery-title">
    <header className="nursery-hero">
      <div><p className="eyebrow">MENÚ PRINCIPAL / VIVERO</p><h1 id="nursery-title">Propagación de<br /><em>material vegetal.</em></h1><p>Cuidamos cada etapa del crecimiento.</p></div>
      <article className="nursery-total" aria-label="Total de plantas"><span>Inventario actual</span><strong>{catalog ? total.toLocaleString("es-CO") : "—"}</strong><h2>Total de plantas</h2><small>{catalog ? "Existencias oficiales en líneas activas" : "Consultando existencias oficiales"}</small>{pending > 0 && <small>{pending} líneas sin inventario registrado</small>}<button type="button" className="button button--secondary" disabled={loading} onClick={() => void load()}>{loading ? "Actualizando…" : "Actualizar total"}</button></article>
    </header>
    {error && <p role="alert" className="alert">{error}</p>}
    <div className="nursery-home-grid">
      <div className="nursery-story">
        <section className="nursery-intro"><p className="eyebrow">01 / LO QUE HACEMOS</p><h2>La vida empieza<br />en el vivero.</h2><p>Nos dedicamos a la propagación de material vegetal de cacay, acompañando el desarrollo de las plantas desde la germinación hasta la injertación.</p></section>
        <section className="nursery-process" aria-labelledby="process-title"><p className="eyebrow">02 / NUESTRO PROCESO</p><h2 id="process-title">Paso a paso, cultivamos futuro.</h2><ol>{stages.map((stage, index) => <li key={stage}><span>{String(index + 1).padStart(2, "0")}</span><strong>{stage}</strong>{index < stages.length - 1 && <i aria-hidden="true">→</i>}</li>)}</ol></section>
        <section className="nursery-team"><div><p className="eyebrow">03 / PERSONAL</p><h2>Un equipo que cuida.</h2><ul><li>Director de vivero</li><li>Asistente</li><li>Auxiliares</li></ul></div><PhotoSpace number={3} label="Nuestro equipo" /></section>
      </div>
      <aside className="nursery-gallery" aria-label="Fotografías del vivero"><PhotoSpace number={1} label="Donde todo comienza" /><PhotoSpace number={2} label="Crecimiento y cuidado" /></aside>
    </div>
    <footer className="nursery-home-footer">VIVERO · PROPAGACIÓN DE MATERIAL VEGETAL<span>Información del inventario en modo consulta</span></footer>
  </section>;
}
