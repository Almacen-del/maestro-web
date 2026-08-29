import {useEffect, useState} from "react";

import type {MonitorDiscard, MonitorRepository, MonitorUser} from "../domain/MonitorModels";

interface DiscardsSectionProps {
  readonly repository: MonitorRepository;
  readonly user: MonitorUser;
}

interface DiscardDialog {
  readonly kind: "APPROVE" | "RETURN";
  readonly discard: MonitorDiscard;
  readonly idempotencyKey: string;
  readonly reason: string;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(date);
}

export function DiscardsSection({repository, user}: DiscardsSectionProps) {
  const [discards, setDiscards] = useState<readonly MonitorDiscard[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [dialog, setDialog] = useState<DiscardDialog>();
  const [processing, setProcessing] = useState(false);

  useEffect(() => repository.observeDiscards(user, (next) => {
    setDiscards(next);
    setError(undefined);
  }, setError), [repository, user]);

  const visible = discards.filter((discard) => {
    const query = search.trim().toLocaleLowerCase("es");
    if (!query) return true;
    return [discard.location.displayName, discard.location.module, discard.location.bed,
      discard.location.line, discard.authorDisplayName].join(" ").toLocaleLowerCase("es").includes(query);
  });

  const openDialog = (kind: DiscardDialog["kind"], discard: MonitorDiscard) => {
    setError(undefined);
    setNotice(undefined);
    setDialog({kind, discard, idempotencyKey: crypto.randomUUID(), reason: ""});
  };

  const submit = async () => {
    if (!dialog || processing) return;
    const reason = dialog.reason.trim();
    const ownAdministrativeApproval = dialog.kind === "APPROVE" &&
      dialog.discard.authorUserId === user.id && user.role === "ADMINISTRADOR";
    if ((dialog.kind === "RETURN" || ownAdministrativeApproval) && reason.length < 3) {
      setError("Escribe un motivo de al menos tres caracteres.");
      return;
    }
    setProcessing(true);
    setError(undefined);
    try {
      if (dialog.kind === "APPROVE") {
        await repository.approveDiscard(
          dialog.discard.id,
          dialog.idempotencyKey,
          ownAdministrativeApproval ? reason : undefined,
        );
        setNotice("Descarte aprobado. El inventario oficial fue descontado una sola vez.");
      } else {
        await repository.returnDiscard(dialog.discard.id, reason, dialog.idempotencyKey);
        setNotice("Descarte devuelto sin modificar el inventario.");
      }
      setDialog(undefined);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "No fue posible revisar el descarte.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className="monitor" aria-labelledby="discard-title">
      <div className="monitor-heading">
        <div>
          <p className="eyebrow">BANDEJA DE REVISIÓN</p>
          <h1 id="discard-title">Descartes pendientes</h1>
          <p>Solo una aprobación descuenta el inventario oficial.</p>
        </div>
        <span className="live-indicator"><i aria-hidden="true" /> Actualización en vivo</span>
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      <div className="monitor-filters">
        <label>
          Buscar ubicación o responsable
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Módulo, cama, línea o persona"
          />
        </label>
      </div>
      {visible.length === 0 ? (
        <p className="empty-state">No hay descartes pendientes que coincidan con el filtro.</p>
      ) : (
        <div className="line-grid" aria-label="Descartes pendientes">
          {visible.map((discard) => {
            const supervisorOwnApproval = discard.authorUserId === user.id && user.role === "SUPERVISOR";
            return (
              <article className="line-card" key={discard.id}>
                <div>
                  <span className="state state--pendiente_revision">PENDIENTE REVISIÓN</span>
                  <h2>{discard.location.displayName}</h2>
                  <p>{discard.location.module} · {discard.location.bed} · {discard.location.line}</p>
                </div>
                <dl className="count-detail">
                  <div><dt>Responsable</dt><dd>{discard.authorDisplayName} · {discard.effectiveRole}</dd></div>
                  <div><dt>Hembras</dt><dd>{discard.females}</dd></div>
                  <div><dt>Machos</dt><dd>{discard.males}</dd></div>
                  <div><dt>Patrones</dt><dd>{discard.rootstocks}</dd></div>
                  <div><dt>Total único</dt><dd><strong>{discard.uniqueTotal}</strong></dd></div>
                  <div><dt>Muertos</dt><dd>{discard.causes.dead}</dd></div>
                  <div><dt>Nematodos</dt><dd>{discard.causes.nematodes}</dd></div>
                  <div><dt>Cuello de ganso</dt><dd>{discard.causes.gooseNeck}</dd></div>
                  <div><dt>Raíces bifurcadas</dt><dd>{discard.causes.bifurcatedRoots}</dd></div>
                  <div><dt>Doble injertación</dt><dd>{discard.causes.doubleGrafting}</dd></div>
                  <div><dt>Versión observada</dt><dd>{discard.observedInventoryVersion}</dd></div>
                  <div><dt>Hora servidor</dt><dd>{formatTime(discard.serverTimestamp)}</dd></div>
                  <div><dt>Observaciones</dt><dd>{discard.observations ?? "Sin observaciones"}</dd></div>
                </dl>
                <p className="read-only-note">
                  Las causas pueden superponerse; el total único es el único valor que se descuenta.
                </p>
                <div className="review-actions">
                  <button
                    className="button"
                    type="button"
                    disabled={supervisorOwnApproval}
                    onClick={() => openDialog("APPROVE", discard)}
                  >
                    Aprobar y descontar
                  </button>
                  <button className="button button--secondary" type="button" onClick={() => openDialog("RETURN", discard)}>
                    Devolver
                  </button>
                </div>
                {supervisorOwnApproval && <p className="warning">Un supervisor no puede aprobar su propio descarte.</p>}
              </article>
            );
          })}
        </div>
      )}
      <p className="read-only-note">
        Maestro no edita capturas ni inventario directamente: toda decisión pasa por el backend transaccional.
      </p>

      {dialog && (
        <div className="dialog-backdrop" role="presentation">
          <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="discard-dialog-title">
            <p className="eyebrow">CONFIRMACIÓN CENTRAL</p>
            <h2 id="discard-dialog-title">
              {dialog.kind === "APPROVE" ? "Aprobar descarte" : "Devolver descarte"}
            </h2>
            <p>{dialog.discard.location.displayName}</p>
            <div className="inventory-summary">
              <strong>Total único: {dialog.discard.uniqueTotal}</strong>
              <span>
                H {dialog.discard.females} · M {dialog.discard.males} · P {dialog.discard.rootstocks}
              </span>
              <span>
                {dialog.kind === "APPROVE"
                  ? "Se descontará del inventario solo al confirmar."
                  : "El inventario no será modificado."}
              </span>
            </div>
            {dialog.kind === "APPROVE" && dialog.discard.authorUserId === user.id && user.role === "ADMINISTRADOR" && (
              <p className="warning">Autorrevisión excepcional: el motivo quedará auditado.</p>
            )}
            {(dialog.kind === "RETURN" ||
              (dialog.kind === "APPROVE" && dialog.discard.authorUserId === user.id && user.role === "ADMINISTRADOR")) && (
              <label>
                {dialog.kind === "RETURN" ? "Motivo de devolución" : "Motivo de la excepción"}
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={dialog.reason}
                  onChange={(event) => setDialog({...dialog, reason: event.target.value})}
                />
              </label>
            )}
            <div className="dialog-actions">
              <button className="button button--secondary" type="button" disabled={processing} onClick={() => setDialog(undefined)}>
                Cancelar
              </button>
              <button className="button" type="button" disabled={processing} onClick={submit}>
                {processing ? "Procesando…" : "Confirmar decisión"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
