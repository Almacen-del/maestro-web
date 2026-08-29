import {useEffect, useMemo, useState} from "react";

import type {
  ManageableCatalogData,
  ManageableCatalogLine,
  ManageableCatalogLocation,
  MonitorRepository,
} from "../domain/MonitorModels";

interface CatalogSectionProps {
  readonly repository: MonitorRepository;
  readonly onCatalogChanged: () => void;
}

interface CreateForm {
  readonly kind: "LOCATION" | "LINE";
  readonly parentId: string;
  readonly code: string;
  readonly type: string;
  readonly displayName: string;
  readonly order: string;
  readonly key: string;
}

interface EditForm {
  readonly kind: "LOCATION" | "LINE";
  readonly target: ManageableCatalogLocation | ManageableCatalogLine;
  readonly displayName: string;
  readonly order: string;
  readonly active: boolean;
  readonly reason: string;
  readonly confirmed: boolean;
  readonly key: string;
}

interface InitialInventoryForm {
  readonly line: ManageableCatalogLine;
  readonly females: string;
  readonly males: string;
  readonly rootstocks: string;
  readonly sourceReference: string;
  readonly confirmed: boolean;
  readonly key: string;
}

const emptyData: ManageableCatalogData = {locations: [], lines: []};

function initialCreate(kind: CreateForm["kind"], parentId = ""): CreateForm {
  return {kind, parentId, code: "", type: "", displayName: "", order: "0", key: crypto.randomUUID()};
}

export function CatalogSection({repository, onCatalogChanged}: CatalogSectionProps) {
  const [data, setData] = useState<ManageableCatalogData>(emptyData);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("TODOS");
  const [stateFilter, setStateFilter] = useState("TODOS");
  const [createForm, setCreateForm] = useState<CreateForm>();
  const [editForm, setEditForm] = useState<EditForm>();
  const [inventoryForm, setInventoryForm] = useState<InitialInventoryForm>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setData(await repository.listManageableCatalog());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar el catálogo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [repository]);

  const types = useMemo(() => [...new Set(data.locations.map((location) => location.type))].sort(), [data]);
  const normalizedSearch = search.trim().toLocaleLowerCase("es");
  const stateMatches = (active: boolean) => stateFilter === "TODOS" || (stateFilter === "ACTIVOS") === active;
  const locationMatches = (location: ManageableCatalogLocation) =>
    (typeFilter === "TODOS" || location.type === typeFilter) && stateMatches(location.active) &&
    `${location.code} ${location.type} ${location.displayName}`.toLocaleLowerCase("es").includes(normalizedSearch);
  const lineMatches = (line: ManageableCatalogLine) => stateMatches(line.active) &&
    `${line.code} ${line.displayName}`.toLocaleLowerCase("es").includes(normalizedSearch);

  const childrenByParent = useMemo(() => {
    const children = new Map<string, ManageableCatalogLocation[]>();
    data.locations.forEach((location) => {
      const key = location.parentId ?? "ROOT";
      children.set(key, [...(children.get(key) ?? []), location]);
    });
    children.forEach((locations) => locations.sort((left, right) => left.order - right.order || left.code.localeCompare(right.code)));
    return children;
  }, [data.locations]);
  const linesByLocation = useMemo(() => {
    const lines = new Map<string, ManageableCatalogLine[]>();
    data.lines.forEach((line) => lines.set(line.locationId, [...(lines.get(line.locationId) ?? []), line]));
    lines.forEach((values) => values.sort((left, right) => left.order - right.order || left.code.localeCompare(right.code)));
    return lines;
  }, [data.lines]);

  const branchVisible = (location: ManageableCatalogLocation, visited = new Set<string>()): boolean => {
    if (visited.has(location.id)) return false;
    const nextVisited = new Set(visited).add(location.id);
    return locationMatches(location) ||
      (linesByLocation.get(location.id) ?? []).some(lineMatches) ||
      (childrenByParent.get(location.id) ?? []).some((child) => branchVisible(child, nextVisited));
  };

  const refreshAfterChange = async (message: string) => {
    setNotice(message);
    setCreateForm(undefined);
    setEditForm(undefined);
    setInventoryForm(undefined);
    await load();
    onCatalogChanged();
  };

  const submitCreate = async () => {
    if (!createForm || saving) return;
    const order = Number(createForm.order);
    if (!createForm.code.trim() || !createForm.displayName.trim() || !Number.isSafeInteger(order) || order < 0) {
      setError("Completa código, nombre y un orden entero no negativo.");
      return;
    }
    if (createForm.kind === "LOCATION" && !createForm.type.trim()) {
      setError("El tipo técnico es obligatorio.");
      return;
    }
    if (createForm.kind === "LINE" && !createForm.parentId) {
      setError("Selecciona una ubicación activa.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      if (createForm.kind === "LOCATION") {
        await repository.createCatalogLocation(
          createForm.code, createForm.type, createForm.parentId || undefined,
          createForm.displayName, order, createForm.key,
        );
        await refreshAfterChange("Ubicación creada mediante operación central.");
      } else {
        await repository.createCatalogLine(
          createForm.parentId, createForm.code, createForm.displayName, order, createForm.key,
        );
        await refreshAfterChange("Línea creada mediante operación central.");
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible crear el registro.");
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!editForm || saving) return;
    const order = Number(editForm.order);
    if (!editForm.displayName.trim() || !Number.isSafeInteger(order) || order < 0 || !editForm.reason.trim()) {
      setError("Nombre, orden y motivo son obligatorios.");
      return;
    }
    if (!editForm.confirmed) {
      setError("Confirma explícitamente el cambio.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      if (editForm.kind === "LOCATION") {
        await repository.updateCatalogLocation(
          editForm.target as ManageableCatalogLocation,
          editForm.displayName, order, editForm.active, editForm.reason, editForm.key,
        );
        await refreshAfterChange("Ubicación actualizada y versionada.");
      } else {
        await repository.updateCatalogLine(
          editForm.target as ManageableCatalogLine,
          editForm.displayName, order, editForm.active, editForm.reason, editForm.key,
        );
        await refreshAfterChange("Línea actualizada y versionada.");
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible actualizar el registro.");
    } finally {
      setSaving(false);
    }
  };

  const submitInitialInventory = async () => {
    if (!inventoryForm || saving) return;
    const females = Number(inventoryForm.females);
    const males = Number(inventoryForm.males);
    const rootstocks = Number(inventoryForm.rootstocks);
    const quantities = [females, males, rootstocks];
    const total = females + males + rootstocks;
    if (quantities.some((value) => !Number.isSafeInteger(value) || value < 0) || !Number.isSafeInteger(total)) {
      setError("Las tres cantidades deben ser enteros no negativos dentro del rango seguro.");
      return;
    }
    if (total === 0) {
      setError("El total cero no está permitido para una carga inicial.");
      return;
    }
    if (inventoryForm.sourceReference.trim().length < 3 || !/[\p{L}\p{N}]/u.test(inventoryForm.sourceReference)) {
      setError("La referencia de fuente debe ser trazable y tener al menos tres caracteres.");
      return;
    }
    if (!inventoryForm.confirmed) {
      setError("Confirma explícitamente la carga inmutable.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await repository.registerInitialInventory(
        inventoryForm.line, females, males, rootstocks,
        inventoryForm.sourceReference, inventoryForm.key,
      );
      await refreshAfterChange("Inventario inicial registrado de forma inmutable.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible registrar el inventario inicial.");
    } finally {
      setSaving(false);
    }
  };

  const openLocationEdit = (location: ManageableCatalogLocation) => setEditForm({
    kind: "LOCATION", target: location, displayName: location.displayName,
    order: String(location.order), active: location.active, reason: "", confirmed: false, key: crypto.randomUUID(),
  });
  const openLineEdit = (line: ManageableCatalogLine) => setEditForm({
    kind: "LINE", target: line, displayName: line.displayName,
    order: String(line.order), active: line.active, reason: "", confirmed: false, key: crypto.randomUUID(),
  });
  const openInitialInventory = (line: ManageableCatalogLine) => setInventoryForm({
    line, females: "", males: "", rootstocks: "", sourceReference: "",
    confirmed: false, key: crypto.randomUUID(),
  });

  const renderLocation = (location: ManageableCatalogLocation, visited = new Set<string>()) => {
    if (visited.has(location.id) || !branchVisible(location)) return null;
    const nextVisited = new Set(visited).add(location.id);
    const childLocations = childrenByParent.get(location.id) ?? [];
    const lines = (linesByLocation.get(location.id) ?? []).filter(lineMatches);
    return (
      <details className="catalog-tree-node" open key={location.id}>
        <summary>
          <span>{location.displayName}</span>
          <small>{location.code} · {location.type} · v{location.version} · {location.active ? "ACTIVA" : "INACTIVA"}</small>
        </summary>
        <div className="catalog-node-body">
          <p>Padre: {location.parentId ?? "RAÍZ"} · Orden: {location.order}</p>
          <p>{location.activeChildCount} hija(s) activa(s) · {location.activeLineCount} línea(s) activa(s)</p>
          <div className="catalog-actions">
            <button className="button button--secondary" type="button" onClick={() => openLocationEdit(location)}>Editar ubicación</button>
            {location.active && <button className="button button--secondary" type="button" onClick={() => setCreateForm(initialCreate("LOCATION", location.id))}>Nueva hija</button>}
            {location.active && <button className="button button--secondary" type="button" onClick={() => setCreateForm(initialCreate("LINE", location.id))}>Nueva línea</button>}
          </div>
          {lines.map((line) => (
            <article className={line.active ? "catalog-admin-line" : "catalog-admin-line catalog-admin-line--inactive"} key={line.id}>
              <div>
                <strong>{line.displayName}</strong>
                <span>{line.code} · v{line.version} · orden {line.order} · {line.active ? "ACTIVA" : "INACTIVA"}</span>
                {line.occupiedByActiveJourney && <em>Bloqueada por una jornada ACTIVA.</em>}
                {line.draftSelectionCount > 0 && <em>Seleccionada en {line.draftSelectionCount} borrador(es); la selección se conservará.</em>}
              </div>
              <div className={line.inventory ? "catalog-inventory" : "catalog-inventory catalog-inventory--empty"}>
                <strong>{line.inventory ? "INICIALIZADO" : "SIN INICIALIZAR"}</strong>
                {line.inventory ? (
                  <>
                    <span>H {line.inventory.females} · M {line.inventory.males} · P {line.inventory.rootstocks} · Total {line.inventory.total}</span>
                    <span>v{line.inventory.version} · {line.inventory.origin}</span>
                    <span>{line.inventory.actorDisplayName} · {new Date(line.inventory.updatedAt).toLocaleString("es-CO")}</span>
                    {line.inventory.initialSourceReference && <span>Fuente inicial: {line.inventory.initialSourceReference}</span>}
                  </>
                ) : !line.initialInventoryEligible ? (
                  <span>No elegible: {line.initialInventoryIneligibleReason ?? "actividad o estado incompatible"}</span>
                ) : null}
              </div>
              {!line.inventory && line.initialInventoryEligible && (
                <button className="button" type="button" onClick={() => openInitialInventory(line)}>
                  Registrar inventario inicial
                </button>
              )}
              <button className="button button--secondary" type="button" disabled={line.occupiedByActiveJourney} onClick={() => openLineEdit(line)}>
                Editar línea
              </button>
            </article>
          ))}
          <div className="catalog-tree-children">
            {childLocations.map((child) => renderLocation(child, nextVisited))}
          </div>
        </div>
      </details>
    );
  };

  const roots = childrenByParent.get("ROOT") ?? [];
  const orphanRoots = data.locations.filter((location) => location.parentId && !data.locations.some((item) => item.id === location.parentId));

  return (
    <section className="catalog-admin" aria-labelledby="catalog-title">
      <header className="section-heading">
        <div><p className="eyebrow">ETAPA 17 · ADMINISTRACIÓN CENTRAL</p><h1 id="catalog-title">Catálogo</h1></div>
        <button className="button" type="button" onClick={() => setCreateForm(initialCreate("LOCATION"))}>Nueva ubicación raíz</button>
      </header>
      <p className="read-only-note">La jerarquía es genérica. Los tipos actuales son fixtures y no definen la estructura productiva.</p>
      <div className="catalog-admin-filters">
        <label>Buscar<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Código o nombre" /></label>
        <label>Tipo<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="TODOS">Todos</option>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Estado<select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}><option value="TODOS">Todos</option><option value="ACTIVOS">Activos</option><option value="INACTIVOS">Inactivos</option></select></label>
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {loading ? <p>Cargando catálogo…</p> : <div className="catalog-tree">{[...roots, ...orphanRoots].map((location) => renderLocation(location))}</div>}

      {createForm && (
        <div className="dialog-backdrop" role="presentation"><section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="create-catalog-title">
          <h2 id="create-catalog-title">{createForm.kind === "LOCATION" ? "Crear ubicación" : "Crear línea"}</h2>
          {createForm.kind === "LOCATION" && <label>Padre<select value={createForm.parentId} onChange={(event) => setCreateForm({...createForm, parentId: event.target.value})}><option value="">Sin padre — raíz</option>{data.locations.filter((location) => location.active).map((location) => <option key={location.id} value={location.id}>{location.displayName} · {location.code}</option>)}</select></label>}
          {createForm.kind === "LINE" && <p>Ubicación: {data.locations.find((location) => location.id === createForm.parentId)?.displayName}</p>}
          <label>Código<input value={createForm.code} onChange={(event) => setCreateForm({...createForm, code: event.target.value})} /></label>
          {createForm.kind === "LOCATION" && <label>Tipo técnico<input value={createForm.type} onChange={(event) => setCreateForm({...createForm, type: event.target.value})} /></label>}
          <label>Nombre visible<input value={createForm.displayName} onChange={(event) => setCreateForm({...createForm, displayName: event.target.value})} /></label>
          <label>Orden<input type="number" min="0" value={createForm.order} onChange={(event) => setCreateForm({...createForm, order: event.target.value})} /></label>
          <p className="warning">Código, tipo, padre y ubicación serán inmutables después de crear.</p>
          <div className="dialog-actions"><button className="button button--secondary" type="button" disabled={saving} onClick={() => setCreateForm(undefined)}>Cancelar</button><button className="button" type="button" disabled={saving} onClick={submitCreate}>{saving ? "Guardando…" : "Crear"}</button></div>
        </section></div>
      )}

      {editForm && (
        <div className="dialog-backdrop" role="presentation"><section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-catalog-title">
          <h2 id="edit-catalog-title">Editar {editForm.kind === "LOCATION" ? "ubicación" : "línea"}</h2>
          <p>Código inmutable: {editForm.target.code} · versión observada {editForm.target.version}</p>
          <label>Nombre visible<input value={editForm.displayName} onChange={(event) => setEditForm({...editForm, displayName: event.target.value, confirmed: false, key: editForm.confirmed ? crypto.randomUUID() : editForm.key})} /></label>
          <label>Orden<input type="number" min="0" value={editForm.order} onChange={(event) => setEditForm({...editForm, order: event.target.value, confirmed: false, key: editForm.confirmed ? crypto.randomUUID() : editForm.key})} /></label>
          <label className="explicit-confirmation"><input type="checkbox" checked={editForm.active} disabled={editForm.kind === "LOCATION" && editForm.target.active && ((editForm.target as ManageableCatalogLocation).activeChildCount > 0 || (editForm.target as ManageableCatalogLocation).activeLineCount > 0)} onChange={(event) => setEditForm({...editForm, active: event.target.checked, confirmed: false, key: editForm.confirmed ? crypto.randomUUID() : editForm.key})} />Registro activo</label>
          {editForm.kind === "LOCATION" && editForm.target.active && ((editForm.target as ManageableCatalogLocation).activeChildCount > 0 || (editForm.target as ManageableCatalogLocation).activeLineCount > 0) && <p className="warning">No puede desactivarse mientras conserve hijas o líneas activas.</p>}
          {editForm.kind === "LINE" && (editForm.target as ManageableCatalogLine).draftSelectionCount > 0 && <p className="warning">Los borradores conservarán esta línea y la mostrarán como inválida si se desactiva.</p>}
          <label>Motivo obligatorio<textarea maxLength={2000} rows={3} value={editForm.reason} onChange={(event) => setEditForm({...editForm, reason: event.target.value, confirmed: false, key: editForm.confirmed ? crypto.randomUUID() : editForm.key})} /></label>
          <div className="inventory-summary"><strong>Resumen</strong><span>{editForm.target.displayName} → {editForm.displayName}</span><span>Orden {editForm.target.order} → {editForm.order}</span><span>Estado → {editForm.active ? "ACTIVO" : "INACTIVO"}</span></div>
          <label className="explicit-confirmation"><input type="checkbox" checked={editForm.confirmed} onChange={(event) => setEditForm({...editForm, confirmed: event.target.checked})} />Confirmo este cambio central.</label>
          <div className="dialog-actions"><button className="button button--secondary" type="button" disabled={saving} onClick={() => setEditForm(undefined)}>Cancelar</button><button className="button" type="button" disabled={saving || !editForm.confirmed} onClick={submitEdit}>{saving ? "Guardando…" : "Confirmar cambio"}</button></div>
        </section></div>
      )}

      {inventoryForm && (() => {
        const females = Number(inventoryForm.females);
        const males = Number(inventoryForm.males);
        const rootstocks = Number(inventoryForm.rootstocks);
        const total = [females, males, rootstocks].every(Number.isSafeInteger)
          ? females + males + rootstocks
          : Number.NaN;
        return (
          <div className="dialog-backdrop" role="presentation"><section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="initial-inventory-title">
            <h2 id="initial-inventory-title">Registrar inventario inicial</h2>
            <p>{inventoryForm.line.displayName} · {inventoryForm.line.code} · versión de línea {inventoryForm.line.version}</p>
            <p className="warning">Esta operación es inmutable. Verifica las cifras y la referencia antes de confirmar.</p>
            <label>Hembras<input aria-label="Hembras iniciales" type="number" min="0" step="1" inputMode="numeric" value={inventoryForm.females} onChange={(event) => setInventoryForm({...inventoryForm, females: event.target.value, confirmed: false})} /></label>
            <label>Machos<input aria-label="Machos iniciales" type="number" min="0" step="1" inputMode="numeric" value={inventoryForm.males} onChange={(event) => setInventoryForm({...inventoryForm, males: event.target.value, confirmed: false})} /></label>
            <label>Patrones<input aria-label="Patrones iniciales" type="number" min="0" step="1" inputMode="numeric" value={inventoryForm.rootstocks} onChange={(event) => setInventoryForm({...inventoryForm, rootstocks: event.target.value, confirmed: false})} /></label>
            <div className="inventory-summary"><strong>Total calculado</strong><span>{Number.isSafeInteger(total) ? total : "Inválido"}</span></div>
            <label>Referencia de fuente<textarea maxLength={500} rows={3} value={inventoryForm.sourceReference} onChange={(event) => setInventoryForm({...inventoryForm, sourceReference: event.target.value, confirmed: false})} /></label>
            <label className="explicit-confirmation"><input type="checkbox" checked={inventoryForm.confirmed} onChange={(event) => setInventoryForm({...inventoryForm, confirmed: event.target.checked})} />Confirmo que revisé las cifras y la referencia, y que la carga no podrá editarse, reemplazarse ni eliminarse.</label>
            <div className="dialog-actions"><button className="button button--secondary" type="button" disabled={saving} onClick={() => setInventoryForm(undefined)}>Cancelar</button><button className="button" type="button" disabled={saving || !inventoryForm.confirmed} onClick={submitInitialInventory}>{saving ? "Registrando…" : "Registrar inventario inicial"}</button></div>
          </section></div>
        );
      })()}
    </section>
  );
}
