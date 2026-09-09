import {type FormEvent, useEffect, useMemo, useState} from "react";

import type {ManageableCatalogData, MonitorRepository, ProductionLotSummary} from "../domain/MonitorModels";

interface LotsSectionProps { readonly repository: MonitorRepository; }

export function LotsSection({repository}: LotsSectionProps) {
  const [lots, setLots] = useState<readonly ProductionLotSummary[]>([]);
  const [catalog, setCatalog] = useState<ManageableCatalogData>({locations: [], lines: []});
  const [selectedLotId, setSelectedLotId] = useState<string>();
  const [selectedLineIds, setSelectedLineIds] = useState<readonly string[]>([]);
  const [lotType, setLotType] = useState<"SIEMBRA" | "INJERTACION">("SIEMBRA");
  const [showUngrafted, setShowUngrafted] = useState(false);
  const [sowingDate, setSowingDate] = useState("");
  const [species, setSpecies] = useState("");
  const [variety, setVariety] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextLots, nextCatalog] = await Promise.all([repository.listManageableLots(), repository.listManageableCatalog()]);
      setLots(nextLots);
      setCatalog(nextCatalog);
      const selected = nextLots.find((lot) => lot.id === selectedLotId) ?? nextLots[0];
      setSelectedLotId(selected?.id);
      setSelectedLineIds(selected?.lineIds ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar los lotes.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const typedLots = lots.filter((lot) => (lot.lotType ?? "SIEMBRA") === lotType);
  const ungrafted = catalog.lines.filter((line) => line.active && !lots.some((lot) => lot.lotType === "INJERTACION" && lot.lineIds.includes(line.id)));
  const selectedLot = typedLots.find((lot) => lot.id === selectedLotId);
  const assignedElsewhere = useMemo(() => new Map(
    lots.filter((lot) => (lot.lotType ?? "SIEMBRA") === lotType).flatMap((lot) => lot.id === selectedLotId ? [] : lot.lineIds.map((lineId) => [lineId, lot.displayName] as const)),
  ), [lots, selectedLotId, lotType]);
  const visibleLines = catalog.lines.filter((line) => line.active && `${line.code} ${line.displayName}`.toLowerCase().includes(search.toLowerCase()));

  const selectLot = (lot: ProductionLotSummary) => {
    setShowUngrafted(false);
    setSelectedLotId(lot.id);
    setSelectedLineIds(lot.lineIds);
    setNotice(undefined);
    setError(undefined);
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(undefined); setNotice(undefined);
    try {
      const created = await repository.createProductionLot(
        sowingDate.slice(5) + "/" + sowingDate.slice(0, 4), sowingDate, species.trim() || undefined, variety.trim() || undefined, crypto.randomUUID(), lotType,
      );
      setLots((current) => [created, ...current]);
      setShowUngrafted(false);
      setSelectedLotId(created.id); setSelectedLineIds([]);
      setSowingDate(""); setSpecies(""); setVariety("");
      setNotice("Lote creado. Ahora puede asignarle líneas.");
    } catch (createError) { setError(createError instanceof Error ? createError.message : "No fue posible crear el lote."); }
    finally { setSaving(false); }
  };

  const saveLines = async () => {
    if (!selectedLot) return;
    setSaving(true); setError(undefined); setNotice(undefined);
    try {
      const updated = await repository.updateProductionLotLines(
        selectedLot.id, selectedLot.version, selectedLineIds, crypto.randomUUID(),
      );
      setLots((current) => current.map((lot) => lot.id === updated.id ? updated : lot));
      setNotice("Asignación de líneas guardada.");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "No fue posible asignar las líneas."); }
    finally { setSaving(false); }
  };

  return (
    <section className="lots-admin" aria-labelledby="lots-admin-title">
      <div className="admin-dashboard__heading"><div><p className="eyebrow">COHORTES DE SIEMBRA</p><h1 id="lots-admin-title">Lotes productivos</h1><p>Organice líneas sembradas en el mismo periodo, incluso si están en módulos diferentes.</p></div><button className="button button--secondary" disabled={loading} onClick={() => void load()}>{loading ? "Actualizando…" : "Actualizar"}</button></div>
      {error && <p className="alert" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
      <div className="workspace-tabs" aria-label="Tipo de lote">{(["SIEMBRA", "INJERTACION"] as const).map((type) => <button key={type} type="button" className={lotType === type ? "workspace-tab workspace-tab--active" : "workspace-tab"} aria-pressed={lotType === type} onClick={() => { setLotType(type); setShowUngrafted(false); const next = lots.find((lot) => (lot.lotType ?? "SIEMBRA") === type); setSelectedLotId(next?.id); setSelectedLineIds(next?.lineIds ?? []); }}>{type === "SIEMBRA" ? "Por siembra" : "Por injertación"}</button>)}</div>
      <form className="lot-create" onSubmit={create}>
        <h2>Crear lote</h2>
        <label>{lotType === "SIEMBRA" ? "Mes y año de siembra" : "Mes y año de injertación"}<input required type="month" value={sowingDate} onChange={(event) => setSowingDate(event.target.value)} /></label>
        <label>Especie (opcional)<input maxLength={160} value={species} onChange={(event) => setSpecies(event.target.value)} /></label>
        <label>Variedad (opcional)<input maxLength={160} value={variety} onChange={(event) => setVariety(event.target.value)} /></label>
        <button className="button" disabled={saving} type="submit">{saving ? "Guardando…" : "Crear lote"}</button>
      </form>
      <div className="lots-layout">
        <div className="lot-list" aria-label="Lotes registrados">
          {typedLots.length === 0 ? <p className="empty-state">Aún no hay lotes registrados.</p> : typedLots.map((lot) => <button type="button" className={`lot-card${lot.id === selectedLotId ? " lot-card--selected" : ""}`} key={lot.id} onClick={() => selectLot(lot)}><strong>{lot.sowingDate.slice(5, 7)}/{lot.sowingDate.slice(0, 4)}</strong><span>{lot.lineIds.length} líneas · {lot.inventory.total.toLocaleString("es-CO")} plantas</span></button>)}
          {lotType === "INJERTACION" && <button type="button" className="lot-card" aria-pressed={showUngrafted} onClick={() => { setShowUngrafted(true); setSelectedLotId(undefined); }}><strong>Sin injertación</strong><span>{ungrafted.length} líneas</span></button>}
        </div>
        <section className="lot-editor">
          {showUngrafted ? <><h2>Sin injertación</h2>{ungrafted.map((line) => <p key={line.id}>{line.displayName} · {line.inventory?.total.toLocaleString("es-CO") ?? "Sin inventario"} plantas</p>)}</> : !selectedLot ? <p className="empty-state">Seleccione o cree un lote.</p> : <>
            <div className="dashboard-panel__heading"><div><p className="eyebrow">ASIGNACIÓN</p><h2>{selectedLot.displayName}</h2></div><span>{selectedLineIds.length} líneas</span></div>
            <input aria-label="Buscar línea" placeholder="Buscar línea" value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="lot-lines">{visibleLines.map((line) => { const blockedBy = assignedElsewhere.get(line.id); const checked = selectedLineIds.includes(line.id); return <label className={blockedBy ? "lot-line lot-line--blocked" : "lot-line"} key={line.id}><input type="checkbox" checked={checked} disabled={Boolean(blockedBy)} onChange={(event) => setSelectedLineIds((current) => event.target.checked ? [...current, line.id] : current.filter((id) => id !== line.id))} /><span><strong>{line.code} · {line.displayName}</strong>{blockedBy ? <small>Asignada a {blockedBy}</small> : <small>{line.inventory?.total.toLocaleString("es-CO") ?? "Sin inventario"} plantas</small>}</span></label>; })}</div>
            <button className="button" disabled={saving} type="button" onClick={() => void saveLines()}>{saving ? "Guardando…" : "Guardar líneas"}</button>
          </>}
        </section>
      </div>
    </section>
  );
}
