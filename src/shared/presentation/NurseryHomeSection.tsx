import {useEffect, useState} from "react";
import type {ManageableCatalogData, MonitorRepository} from "../domain/MonitorModels";

const stages = ["Germinación", "Trasplante", "Patrón", "Búsqueda de yema", "Injertos", "Plantas de cacay"];

function StageIllustration({index}: {readonly index: number}) {
  const drawings = [
    <><path d="M12 48h40M32 47V29" /><path d="M32 35C17 36 16 25 17 22c12-1 17 5 15 13ZM32 30c-1-12 8-17 16-16 1 10-5 17-16 16Z" /></>,
    <><path d="m20 40 4 16h16l4-16ZM32 39V20M32 28c-10 0-14-6-13-11 9-1 14 3 13 11ZM32 24c0-8 5-12 12-12 0 8-5 12-12 12ZM7 32h12m-5-5 5 5-5 5M46 32h11m-5-5 5 5-5 5" /></>,
    <><path d="M32 52V15M32 31c-13 0-18-7-17-14 11 0 18 5 17 14ZM32 23c0-10 7-14 15-13 0 9-6 14-15 13ZM32 43l-8 13m8-13 8 13M19 52h26" /></>,
    <><path d="m14 52 23-32M26 36c-8-2-12-8-10-14 8 0 14 6 10 14ZM36 22c-2-8 2-14 8-16 5 7 1 13-8 16Z" /><circle cx="43" cy="38" r="11" /><path d="m51 46 8 9M40 38h6m-3-3v6" /></>,
    <><path d="M30 55V34l12-13M30 34 19 23M30 26V12M30 20c0-8 6-11 13-10 0 7-5 11-13 10Z" /><path d="m24 31 13 5m-13 1 13 5m-13 1 13 5M16 55h30" /></>,
    <><path d="M32 54V29M19 55h26" /><path d="M32 40 22 30m10 5 12-12" /><path d="M22 32c-10 0-15-8-11-14 9-1 15 5 11 14ZM32 29c-10-6-10-17-1-22 9 6 10 17 1 22ZM43 27c-2-11 4-16 12-14 2 10-4 16-12 14Z" /><circle cx="44" cy="39" r="4" /></>,
  ];
  return <svg className="nursery-stage-art" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{drawings[index]}</svg>;
}

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
    <div className="nursery-home-grid nursery-home-grid--panorama">
      <div className="nursery-story">
        <section className="nursery-intro"><h2>Cultivamos prosperidad.</h2><p>En Arles S.A.S., cuidamos el crecimiento desde la raíz. Nuestro vivero acompaña cada etapa de la propagación de material vegetal, con dedicación y trabajo en equipo.</p></section>
        <figure className="nursery-panorama"><img src="/vivero-panorama-septiembre.png" alt="Vista panorámica completa del vivero, sus módulos y zonas de cultivo" width="2022" height="778" decoding="async" /></figure>
        <section className="nursery-process" aria-labelledby="process-title"><h2 id="process-title">Nuestro proceso</h2><ol>{stages.map((stage, index) => <li className={`nursery-stage nursery-stage--${index}`} key={stage}><StageIllustration index={index} /><strong>{stage}</strong></li>)}</ol></section>
        <section className="nursery-team"><div><p className="eyebrow">PERSONAL</p><h2>Un equipo que cuida.</h2><ul><li>Director de vivero</li><li>Asistente</li><li>Auxiliares</li></ul></div><PhotoSpace number={3} label="Nuestro equipo" /></section>
      </div>
    </div>
    <footer className="nursery-home-footer">VIVERO · PROPAGACIÓN DE MATERIAL VEGETAL<span>Información del inventario en modo consulta</span></footer>
  </section>;
}
