import {useEffect, useMemo, useRef, useState} from "react";

import type {
  DraftActivationResult,
  DraftCatalogLine,
  DraftParticipantInput,
  DraftParticipantsData,
  ManageableDraftJourney,
  MonitorRepository,
  MonitorRole,
} from "../domain/MonitorModels";

interface DraftParticipantsEditorProps {
  readonly repository: MonitorRepository;
  readonly journey: ManageableDraftJourney;
  readonly catalogLines: readonly DraftCatalogLine[];
  readonly lineSelectionDirty: boolean;
  readonly onActivated: (result: DraftActivationResult) => void | Promise<void>;
  readonly onCancelled: () => void | Promise<void>;
}

const roleLabels: Record<MonitorRole, string> = {
  AUXILIAR: "Auxiliar",
  SUPERVISOR: "Supervisor",
  ADMINISTRADOR: "Administrador",
};

function participantSignature(participants: readonly DraftParticipantInput[]): string {
  return [...participants]
    .sort((left, right) => left.userId.localeCompare(right.userId))
    .map((participant) => `${participant.userId}:${participant.canCount ? "1" : "0"}`)
    .join("|");
}

export function DraftParticipantsEditor({
  repository,
  journey,
  catalogLines,
  lineSelectionDirty,
  onActivated,
  onCancelled,
}: DraftParticipantsEditorProps) {
  const [data, setData] = useState<DraftParticipantsData>();
  const [selection, setSelection] = useState<readonly DraftParticipantInput[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("TODOS");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showActivationSummary, setShowActivationSummary] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showCancelSummary, setShowCancelSummary] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const saveKey = useRef<string | undefined>(undefined);
  const activationKey = useRef<string | undefined>(undefined);
  const cancelKey = useRef<string | undefined>(undefined);

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      const next = await repository.listDraftJourneyParticipants(journey.id);
      setData(next);
      setSelection(next.participants.map((participant) => ({
        userId: participant.id,
        canCount: participant.canCount,
      })));
      setError(undefined);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar participantes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setData(undefined);
    setSelection([]);
    setSearch("");
    setRoleFilter("TODOS");
    setShowSummary(false);
    setShowActivationSummary(false);
    setShowCancelSummary(false);
    setCancelReason("");
    setCancelConfirmed(false);
    setNotice(undefined);
    saveKey.current = undefined;
    activationKey.current = undefined;
    cancelKey.current = undefined;
    void load();
  }, [journey.id, journey.version]);

  useEffect(() => {
    if (!lineSelectionDirty) return;
    activationKey.current = undefined;
    setShowActivationSummary(false);
  }, [lineSelectionDirty]);

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return (data?.activeUsers ?? []).filter((user) =>
      (roleFilter === "TODOS" || user.role === roleFilter) &&
      `${user.displayName} ${roleLabels[user.role]}`.toLocaleLowerCase("es").includes(term)
    );
  }, [data, roleFilter, search]);
  const savedSelection = data?.participants.map((participant) => ({
    userId: participant.id,
    canCount: participant.canCount,
  })) ?? [];
  const participantsDirty = participantSignature(selection) !== participantSignature(savedSelection);
  const savedParticipants = data?.participants ?? [];
  const selectedLines = journey.lineIds.flatMap((lineId) => {
    const line = catalogLines.find((candidate) => candidate.id === lineId);
    return line ? [line] : [];
  });
  const hasCounter = savedParticipants.some((participant) => participant.canCount);
  const hasReviewer = savedParticipants.some((participant) =>
    participant.role === "SUPERVISOR" || participant.role === "ADMINISTRADOR"
  );
  const withinTechnicalLimit = journey.lineIds.length + savedParticipants.length <= 200;
  const activationReady = Boolean(data) &&
    journey.lineIds.length > 0 &&
    selectedLines.length === journey.lineIds.length &&
    hasCounter &&
    hasReviewer &&
    withinTechnicalLimit &&
    !participantsDirty &&
    !lineSelectionDirty &&
    !loading &&
    !saving;
  const cancellationReady = Boolean(data) && !participantsDirty && !lineSelectionDirty && !loading && !saving;

  const updateSelection = (next: readonly DraftParticipantInput[]) => {
    setSelection([...new Map(next.map((participant) => [participant.userId, participant])).values()]);
    saveKey.current = undefined;
    activationKey.current = undefined;
    setShowSummary(false);
    setShowActivationSummary(false);
    setNotice(undefined);
  };

  const toggleParticipant = (userId: string) => {
    const current = selection.find((participant) => participant.userId === userId);
    updateSelection(current
      ? selection.filter((participant) => participant.userId !== userId)
      : [...selection, {userId, canCount: true}]);
  };

  const toggleCanCount = (userId: string) => {
    updateSelection(selection.map((participant) => participant.userId === userId
      ? {...participant, canCount: !participant.canCount}
      : participant));
  };

  const confirmSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(undefined);
    const key = saveKey.current ?? crypto.randomUUID();
    saveKey.current = key;
    try {
      await repository.updateDraftJourneyParticipants(journey.id, selection, key);
      saveKey.current = undefined;
      await load();
      setShowSummary(false);
      setNotice("Participantes guardados centralmente. La jornada continúa en BORRADOR.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar participantes.");
    } finally {
      setSaving(false);
    }
  };

  const confirmActivation = async () => {
    if (!data || !activationReady || activating) return;
    setActivating(true);
    setError(undefined);
    const key = activationKey.current ?? crypto.randomUUID();
    activationKey.current = key;
    try {
      const result = await repository.activateDraftJourney(journey.id, {
        journey: data.version,
        lineSelection: data.lineSelectionVersion,
        participantSelection: data.participantSelectionVersion,
      }, key);
      activationKey.current = undefined;
      setShowActivationSummary(false);
      await onActivated(result);
    } catch (activationError) {
      setError(activationError instanceof Error
        ? activationError.message
        : "No fue posible activar la jornada preparada.");
    } finally {
      setActivating(false);
    }
  };

  const confirmCancellation = async () => {
    const reason = cancelReason.trim();
    if (!data || !cancellationReady || !cancelConfirmed || reason === "" || cancelling) return;
    setCancelling(true);
    setError(undefined);
    const key = cancelKey.current ?? crypto.randomUUID();
    cancelKey.current = key;
    try {
      await repository.cancelDraftJourney(journey.id, data.version, reason, key);
      cancelKey.current = undefined;
      setShowCancelSummary(false);
      await onCancelled();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "No fue posible cancelar el borrador.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section className="draft-participants" aria-labelledby="participants-title">
      <div className="draft-editor-heading">
        <div>
          <span className="state state--draft">BORRADOR</span>
          <h3 id="participants-title">Participantes</h3>
          <p>{selection.length} participantes seleccionados</p>
        </div>
        <div className="draft-heading-actions">
          <button
            className="button button--danger"
            type="button"
            disabled={!cancellationReady || activating || cancelling}
            onClick={() => setShowCancelSummary(true)}
          >
            Cancelar borrador
          </button>
          <button className="button button--secondary" type="button" disabled={loading || saving || activating} onClick={() => setShowSummary(true)}>
            Revisar participantes
          </button>
          <button
            className="button"
            type="button"
            disabled={!activationReady || activating}
            onClick={() => setShowActivationSummary(true)}
          >
            {activating ? "Activando…" : "Activar jornada"}
          </button>
        </div>
      </div>

      <p className="draft-warning">BORRADOR — LOS PARTICIPANTES AÚN NO TIENEN AUTORIZACIÓN OPERATIVA</p>
      {!activationReady && !loading && (
        <p className="warning" role="status">
          Para activar: guarda al menos una línea, un participante que pueda contar y un supervisor o administrador;
          confirma también cualquier cambio pendiente.
        </p>
      )}
      {error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}

      <div className="monitor-filters">
        <label>
          Buscar usuario
          <input
            aria-label="Buscar participante"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre o rol"
          />
        </label>
        <label>
          Rol
          <select aria-label="Filtrar participantes por rol" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="TODOS">Todos</option>
            <option value="AUXILIAR">Auxiliares</option>
            <option value="SUPERVISOR">Supervisores</option>
            <option value="ADMINISTRADOR">Administradores</option>
          </select>
        </label>
      </div>

      {loading ? <p>Cargando usuarios activos…</p> : (
        <div className="participant-list">
          {visibleUsers.map((user) => {
            const selected = selection.find((participant) => participant.userId === user.id);
            return (
              <div className={selected ? "participant-row participant-row--selected" : "participant-row"} key={user.id}>
                <label>
                  <input
                    aria-label={`Seleccionar ${user.displayName}`}
                    type="checkbox"
                    checked={Boolean(selected)}
                    onChange={() => toggleParticipant(user.id)}
                  />
                  <span><strong>{user.displayName}</strong><small>{roleLabels[user.role]}</small></span>
                </label>
                <label className="can-count-toggle">
                  <input
                    aria-label={`Puede contar ${user.displayName}`}
                    type="checkbox"
                    checked={selected?.canCount ?? false}
                    disabled={!selected}
                    onChange={() => toggleCanCount(user.id)}
                  />
                  Puede contar
                </label>
              </div>
            );
          })}
        </div>
      )}

      {showSummary && (
        <div className="dialog-backdrop" role="presentation">
          <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="participant-summary-title">
            <p className="eyebrow">CONFIRMACIÓN CENTRAL</p>
            <h2 id="participant-summary-title">Guardar participantes</h2>
            <div className="inventory-summary" aria-label="Resumen de participantes">
              <strong>{journey.displayName}</strong>
              <span>Estado: BORRADOR</span>
              <span>Participantes: {selection.length}</span>
              <span>Con permiso para contar: {selection.filter((participant) => participant.canCount).length}</span>
              <span>No se crearán autorizaciones operativas.</span>
            </div>
            <div className="dialog-actions">
              <button className="button button--secondary" type="button" disabled={saving} onClick={() => setShowSummary(false)}>
                Volver
              </button>
              <button className="button" type="button" disabled={saving} onClick={confirmSave}>
                {saving ? "Guardando…" : "Confirmar participantes"}
              </button>
            </div>
          </section>
        </div>
      )}

      {showActivationSummary && data && (
        <div className="dialog-backdrop" role="presentation">
          <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="activation-summary-title">
            <p className="eyebrow">ACTIVACIÓN TRANSACCIONAL</p>
            <h2 id="activation-summary-title">Activar jornada</h2>
            <div className="inventory-summary" aria-label="Resumen de activación de jornada">
              <strong>{journey.displayName}</strong>
              {journey.configuracionInformeInventario ? (
                <>
                  <strong>Informe de inventario</strong>
                  <span>
                    {journey.configuracionInformeInventario.habilitado ? "Habilitado" : "Deshabilitado"}
                    {journey.configuracionInformeInventario.habilitado
                      ? ` · ${journey.configuracionInformeInventario.mes}/${journey.configuracionInformeInventario.anio}`
                      : ""}
                  </span>
                  <span>
                    Fuente de plantas muertas: {journey.configuracionInformeInventario.fuentePlantasMuertas === "CONTEO_FISICO"
                      ? "Conteo físico"
                      : "Descartes aprobados"}
                  </span>
                </>
              ) : <span>Informe de inventario: sin configuración.</span>}
              <span>Líneas: {selectedLines.length}</span>
              {selectedLines.map((line) => (
                <span key={line.id}>
                  {line.location.nursery} · {line.location.module} · {line.location.bed} · {line.displayName}
                </span>
              ))}
              <strong>Participantes y permisos</strong>
              {savedParticipants.map((participant) => (
                <span key={participant.id}>
                  {participant.displayName} · {roleLabels[participant.role]} · {participant.canCount ? "Puede contar" : "No cuenta"}
                </span>
              ))}
            </div>
            <p className="warning">Después de confirmar, Vivero Campo podrá ver esta jornada.</p>
            <p className="warning">La jornada activa no podrá editarse durante esta etapa.</p>
            <p className="warning">La configuración del informe quedará bloqueada al activar la jornada.</p>
            <div className="dialog-actions">
              <button
                className="button button--secondary"
                type="button"
                disabled={activating}
                onClick={() => setShowActivationSummary(false)}
              >
                Volver
              </button>
              <button className="button" type="button" disabled={activating} onClick={confirmActivation}>
                {activating ? "Activando…" : "Confirmar activación"}
              </button>
            </div>
          </section>
        </div>
      )}

      {showCancelSummary && data && (
        <div className="dialog-backdrop" role="presentation">
          <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-draft-title">
            <p className="eyebrow">CANCELACIÓN TRANSACCIONAL</p>
            <h2 id="cancel-draft-title">Cancelar borrador</h2>
            <div className="inventory-summary" aria-label="Resumen de cancelación del borrador">
              <strong>{journey.displayName}</strong>
              <span>Líneas conservadas: {selectedLines.length}</span>
              <span>Participantes conservados: {savedParticipants.length}</span>
              {savedParticipants.map((participant) => (
                <span key={participant.id}>{participant.displayName} · {roleLabels[participant.role]}</span>
              ))}
            </div>
            <label>
              Motivo obligatorio
              <textarea
                aria-label="Motivo de cancelación"
                maxLength={2000}
                value={cancelReason}
                onChange={(event) => {
                  setCancelReason(event.target.value);
                  cancelKey.current = undefined;
                }}
              />
            </label>
            <p className="warning">La jornada dejará de ser editable. Las selecciones se conservarán.</p>
            <label className="confirmation-check">
              <input
                type="checkbox"
                checked={cancelConfirmed}
                onChange={(event) => setCancelConfirmed(event.target.checked)}
              />
              Confirmo que deseo cancelar este borrador.
            </label>
            <div className="dialog-actions">
              <button className="button button--secondary" type="button" disabled={cancelling} onClick={() => setShowCancelSummary(false)}>
                Volver
              </button>
              <button
                className="button button--danger"
                type="button"
                disabled={cancelling || !cancelConfirmed || cancelReason.trim() === ""}
                onClick={confirmCancellation}
              >
                {cancelling ? "Cancelando…" : "Confirmar cancelación"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
