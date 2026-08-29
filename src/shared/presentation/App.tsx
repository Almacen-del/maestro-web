import {type FormEvent, useEffect, useRef, useState} from "react";

import type {
  MonitorLine,
  MonitorJourney,
  MonitorRepository,
  MonitorSnapshot,
  MonitorUnsubscribe,
  MonitorUser,
} from "../domain/MonitorModels";
import {sortMonitorLines} from "../domain/MonitorModels";
import {CatalogSection} from "./CatalogSection";
import {DraftJourneysSection} from "./DraftJourneysSection";
import {InventoryReportsSection} from "./InventoryReportsSection";
import type {ReportPlatform} from "./InventoryReportsSection";
import {DiscardsSection} from "./DiscardsSection";
import {MigrationValidationSection} from "./MigrationValidationSection";
import {ModuleMapSection} from "./ModuleMapSection";
import {UsersSection} from "./UsersSection";
import "./app.css";

interface AppProps {
  readonly repository: MonitorRepository;
  readonly reportPlatform?: ReportPlatform;
}

interface ReviewDialog {
  readonly kind: "APPROVE" | "RETURN";
  readonly line: MonitorLine;
  readonly idempotencyKey: string;
  readonly attempted: boolean;
  readonly reason: string;
}

interface ReassignmentDialog {
  readonly line: MonitorLine;
  readonly idempotencyKey: string;
  readonly targetUserId: string;
  readonly reason: string;
  readonly showSummary: boolean;
  readonly attempted: boolean;
}

interface ReleaseDialog {
  readonly line: MonitorLine;
  readonly idempotencyKey: string;
  readonly reason: string;
  readonly showSummary: boolean;
  readonly attempted: boolean;
}

interface CloseDialog {
  readonly idempotencyKey: string;
  readonly attempted: boolean;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("es-CO", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Bogota",
      }).format(date);
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function App({repository, reportPlatform}: AppProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<MonitorUser>();
  const [activeSection, setActiveSection] = useState<
    "MONITOR" | "MAP" | "DISCARDS" | "JOURNEYS" | "REPORTS" | "USERS" | "CATALOG" | "MIGRATION"
  >(() => new URLSearchParams(window.location.search).has("code") ? "REPORTS" : "MONITOR");
  const [journeys, setJourneys] = useState<readonly MonitorJourney[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>();
  const [snapshot, setSnapshot] = useState<MonitorSnapshot>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("PENDIENTE_REVISION");
  const [reviewDialog, setReviewDialog] = useState<ReviewDialog>();
  const [reviewing, setReviewing] = useState(false);
  const [reassignmentDialog, setReassignmentDialog] = useState<ReassignmentDialog>();
  const [reassigning, setReassigning] = useState(false);
  const [releaseDialog, setReleaseDialog] = useState<ReleaseDialog>();
  const [releasing, setReleasing] = useState(false);
  const [closeDialog, setCloseDialog] = useState<CloseDialog>();
  const [closing, setClosing] = useState(false);
  const [draftRefreshVersion, setDraftRefreshVersion] = useState(0);
  const unsubscribeRef = useRef<MonitorUnsubscribe | undefined>(undefined);

  useEffect(() => () => unsubscribeRef.current?.(), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void repository.restoreSession()
      .then(async (restoredUser) => {
        if (!active || !restoredUser) return;
        const activeJourneys = await repository.listActiveJourneys();
        if (!active) return;
        setUser(restoredUser);
        setJourneys(activeJourneys);
        if (activeJourneys.length === 1 && activeJourneys[0]) {
          startMonitoring(restoredUser, activeJourneys[0].id);
        }
      })
      .catch((restoreError: unknown) => {
        if (active) setError(restoreError instanceof Error
          ? restoreError.message : "No fue posible restaurar la sesión.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const startMonitoring = (monitorUser: MonitorUser, journeyId: string) => {
    unsubscribeRef.current?.();
    setSelectedJourneyId(journeyId);
    setSnapshot(undefined);
    setReviewDialog(undefined);
    setReassignmentDialog(undefined);
    setReleaseDialog(undefined);
    setCloseDialog(undefined);
    setError(undefined);
    unsubscribeRef.current = repository.observeMonitor(
      monitorUser,
      journeyId,
      (nextSnapshot) => {
        setSnapshot(nextSnapshot);
        setError(undefined);
      },
      setError,
    );
  };

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const signedInUser = await repository.signIn(email, password);
      const activeJourneys = await repository.listActiveJourneys();
      setUser(signedInUser);
      setJourneys(activeJourneys);
      setPassword("");
      if (activeJourneys.length === 1 && activeJourneys[0]) {
        startMonitoring(signedInUser, activeJourneys[0].id);
      } else if (activeJourneys.length === 0) {
        setError("No hay jornadas activas autorizadas para esta cuenta.");
      }
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "No fue posible iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = undefined;
    await repository.signOut();
    setUser(undefined);
    setActiveSection("MONITOR");
    setJourneys([]);
    setSelectedJourneyId(undefined);
    setSnapshot(undefined);
    setError(undefined);
    setNotice(undefined);
    setSearch("");
    setStateFilter("PENDIENTE_REVISION");
    setReviewDialog(undefined);
    setReassignmentDialog(undefined);
    setReleaseDialog(undefined);
    setCloseDialog(undefined);
  };

  useEffect(() => {
    if (!user) return undefined;
    return repository.observeAccountStatus(
      user.id,
      (active) => {
        if (active) return;
        unsubscribeRef.current?.();
        unsubscribeRef.current = undefined;
        void repository.signOut().finally(() => {
          setUser(undefined);
          setActiveSection("MONITOR");
          setJourneys([]);
          setSelectedJourneyId(undefined);
          setSnapshot(undefined);
          setReviewDialog(undefined);
          setReassignmentDialog(undefined);
          setReleaseDialog(undefined);
          setCloseDialog(undefined);
          setNotice(undefined);
          setError("Cuenta desactivada");
        });
      },
      setError,
    );
  }, [repository, user]);

  const openReview = (kind: ReviewDialog["kind"], line: MonitorLine) => {
    setError(undefined);
    setNotice(undefined);
    setReviewDialog({kind, line, idempotencyKey: crypto.randomUUID(), attempted: false, reason: ""});
  };

  const updateReviewReason = (reason: string) => {
    setReviewDialog((current) => current && ({
      ...current,
      reason,
      idempotencyKey: current.attempted ? crypto.randomUUID() : current.idempotencyKey,
      attempted: false,
    }));
  };

  const submitReview = async () => {
    if (!reviewDialog?.line.count || !user || reviewing) return;
    const selfApproval = reviewDialog.line.count.authorUserId === user.id;
    const reason = reviewDialog.reason.trim();
    if (reviewDialog.kind === "RETURN" && reason === "") {
      setError("Escribe el motivo de la devolución.");
      return;
    }
    if (reviewDialog.kind === "APPROVE" && selfApproval && user.role === "ADMINISTRADOR" && reason === "") {
      setError("La aprobación excepcional del propio conteo exige un motivo.");
      return;
    }
    setReviewing(true);
    setError(undefined);
    setReviewDialog({...reviewDialog, attempted: true});
    try {
      if (reviewDialog.kind === "APPROVE") {
        await repository.approveCount(
          reviewDialog.line.count.id,
          reviewDialog.idempotencyKey,
          selfApproval && user.role === "ADMINISTRADOR" ? reason : undefined,
        );
        setNotice("Conteo aprobado mediante transacción central.");
      } else {
        await repository.returnCount(reviewDialog.line.count.id, reason, reviewDialog.idempotencyKey);
        setNotice("Conteo devuelto mediante transacción central.");
      }
      setReviewDialog(undefined);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "No fue posible completar la revisión.");
    } finally {
      setReviewing(false);
    }
  };

  const openReassignment = (line: MonitorLine) => {
    setError(undefined);
    setNotice(undefined);
    setReassignmentDialog({
      line,
      idempotencyKey: crypto.randomUUID(),
      targetUserId: "",
      reason: "",
      showSummary: false,
      attempted: false,
    });
  };

  const updateReassignment = (changes: Partial<Pick<ReassignmentDialog, "targetUserId" | "reason">>) => {
    setReassignmentDialog((current) => current && ({
      ...current,
      ...changes,
      idempotencyKey: current.attempted ? crypto.randomUUID() : current.idempotencyKey,
      showSummary: false,
      attempted: false,
    }));
  };

  const reviewReassignment = () => {
    if (!reassignmentDialog) return;
    if (!reassignmentDialog.targetUserId) {
      setError("Selecciona una persona activa y autorizada.");
      return;
    }
    if (!reassignmentDialog.reason.trim()) {
      setError("Escribe el motivo de la reasignación.");
      return;
    }
    setError(undefined);
    setReassignmentDialog({...reassignmentDialog, reason: reassignmentDialog.reason.trim(), showSummary: true});
  };

  const submitReassignment = async () => {
    if (!reassignmentDialog?.line.count || !reassignmentDialog.showSummary || reassigning) return;
    setReassigning(true);
    setError(undefined);
    setReassignmentDialog({...reassignmentDialog, attempted: true});
    try {
      await repository.reassignCountCorrection(
        reassignmentDialog.line.count.id,
        reassignmentDialog.targetUserId,
        reassignmentDialog.reason,
        reassignmentDialog.idempotencyKey,
      );
      setNotice("Corrección reasignada mediante transacción central.");
      setReassignmentDialog(undefined);
    } catch (reassignmentError) {
      setError(reassignmentError instanceof Error ? reassignmentError.message : "No fue posible reasignar la corrección.");
    } finally {
      setReassigning(false);
    }
  };

  const openRelease = (line: MonitorLine) => {
    if (!line.reservation) return;
    setError(undefined);
    setNotice(undefined);
    setReleaseDialog({
      line,
      idempotencyKey: crypto.randomUUID(),
      reason: "",
      showSummary: false,
      attempted: false,
    });
  };

  const updateReleaseReason = (reason: string) => {
    setReleaseDialog((current) => current && ({
      ...current,
      reason,
      idempotencyKey: current.attempted ? crypto.randomUUID() : current.idempotencyKey,
      showSummary: false,
      attempted: false,
    }));
  };

  const reviewRelease = () => {
    if (!releaseDialog) return;
    if (!releaseDialog.reason.trim()) {
      setError("Escribe el motivo de la liberación manual.");
      return;
    }
    setError(undefined);
    setReleaseDialog({...releaseDialog, reason: releaseDialog.reason.trim(), showSummary: true});
  };

  const submitRelease = async () => {
    const reservation = releaseDialog?.line.reservation;
    if (!releaseDialog?.showSummary || !reservation || releasing) return;
    setReleasing(true);
    setError(undefined);
    setReleaseDialog({...releaseDialog, attempted: true});
    try {
      await repository.releaseReservation(
        reservation.id,
        releaseDialog.reason,
        releaseDialog.idempotencyKey,
      );
      setNotice("Reserva liberada mediante transacción central.");
      setReleaseDialog(undefined);
    } catch (releaseError) {
      setError(releaseError instanceof Error ? releaseError.message : "No fue posible liberar la reserva.");
    } finally {
      setReleasing(false);
    }
  };

  const refreshActiveJourneys = async () => {
    try {
      setJourneys(await repository.listActiveJourneys());
    } catch (refreshError) {
      setError(refreshError instanceof Error
        ? refreshError.message
        : "La jornada fue activada, pero no fue posible refrescar la lista activa.");
    }
  };

  const selectedJourney = journeys.find((journey) => journey.id === selectedJourneyId);
  const closeStateCounts = (snapshot?.lines ?? []).reduce<Record<string, number>>((counts, line) => ({
    ...counts,
    [line.state]: (counts[line.state] ?? 0) + 1,
  }), {});
  const approvedCount = closeStateCounts.APROBADA ?? 0;
  const pendingCount = (snapshot?.lines.length ?? 0) - approvedCount;
  const activeReservationCount = (snapshot?.lines ?? []).filter((line) => line.reservation !== undefined).length;
  const pendingCorrectionCount = (snapshot?.lines ?? []).filter((line) =>
    line.state === "DEVUELTA" || line.activeReassignmentId !== undefined || line.correctionResponsibility !== undefined
  ).length;
  const canCloseSelectedJourney = Boolean(
    user && selectedJourney?.canClose
  );
  const closeBlockers = snapshot === undefined
    ? ["Esperando el estado central de la jornada."]
    : [
        ...(pendingCount > 0 ? [`${pendingCount} línea(s) todavía no tienen estado APROBADA.`] : []),
        ...(activeReservationCount > 0 ? [`${activeReservationCount} reserva(s) activa(s).`] : []),
        ...(pendingCorrectionCount > 0 ? [`${pendingCorrectionCount} corrección(es) o reasignación(es) pendiente(s).`] : []),
        ...(selectedJourney?.configuracionInformeInventario?.fuentePlantasMuertas === "DESCARTES_APROBADOS" &&
          (selectedJourney.cantidadDescartesPendientes ?? 0) > 0
          ? [`${selectedJourney.cantidadDescartesPendientes} descarte(s) pendiente(s) de revisión.`]
          : []),
      ];

  const submitCloseJourney = async () => {
    if (!closeDialog || !selectedJourney || closeBlockers.length > 0 || closing) return;
    setClosing(true);
    setError(undefined);
    setCloseDialog({...closeDialog, attempted: true});
    try {
      const closeOutcome = await repository.closeJourney(
        selectedJourney.id,
        selectedJourney.version,
        closeDialog.idempotencyKey,
      );
      unsubscribeRef.current?.();
      unsubscribeRef.current = undefined;
      setSelectedJourneyId(undefined);
      setSnapshot(undefined);
      setCloseDialog(undefined);
      setDraftRefreshVersion((version) => version + 1);
      setNotice(closeOutcome.state === "CERRANDO"
        ? "Cierre iniciado. La jornada quedó bloqueada para trabajo nuevo y se procesará por fases. Consulta Jornadas para ver el progreso o recuperarla."
        : selectedJourney.configuracionInformeInventario?.habilitado
          ? "Jornada cerrada. Ya no está disponible en Campo y sus líneas quedaron liberadas. El informe de inventario quedó pendiente de procesamiento central."
          : "Jornada cerrada. Ya no está disponible en Campo y sus líneas quedaron liberadas.");
      try {
        setJourneys(await repository.listActiveJourneys());
      } catch {
        setJourneys((current) => current.filter((journey) => journey.id !== selectedJourney.id));
        setError("La jornada se cerró, pero no fue posible refrescar la lista activa.");
      }
    } catch (closeError) {
      const closeMessage = closeError instanceof Error ? closeError.message : "No fue posible cerrar la jornada.";
      try {
        const refreshed = await repository.listActiveJourneys();
        setJourneys(refreshed);
        if (!refreshed.some((journey) => journey.id === selectedJourney.id)) {
          unsubscribeRef.current?.();
          unsubscribeRef.current = undefined;
          setSelectedJourneyId(undefined);
          setSnapshot(undefined);
          setCloseDialog(undefined);
          setDraftRefreshVersion((version) => version + 1);
          setError(`${closeMessage} La jornada quedó CERRANDO; consulta Jornadas para ver el progreso o recuperarla.`);
        } else {
          setError(closeMessage);
        }
      } catch {
        setError(closeMessage);
      }
    } finally {
      setClosing(false);
    }
  };

  const visibleLines = sortMonitorLines(snapshot?.lines ?? []).filter((line) => {
    const haystack = Object.values(line.location).join(" ").toLocaleLowerCase("es");
    return (stateFilter === "TODOS" || line.state === stateFilter) &&
      haystack.includes(search.trim().toLocaleLowerCase("es"));
  });
  const production = repository.environment === "PRODUCTION";
  const environmentLabel = repository.environment === "EMULATOR"
    ? "MODO DE PRUEBA — EMULADOR"
    : production
      ? "PRODUCCIÓN"
      : "FIREBASE DESHABILITADO";
  const environmentClass = repository.environment === "DISABLED"
    ? "environment-banner environment-banner--danger"
    : production
      ? "environment-banner environment-banner--production"
      : "environment-banner";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="brand-mark" aria-hidden="true">VC</span>
          <div>
            <strong>Vivero Maestro</strong>
            <small>Revisión transaccional de conteos y descartes</small>
          </div>
        </div>
        {user && (
          <div className="session">
            <span>{user.displayName} · {user.role}</span>
            <button className="button button--secondary" type="button" onClick={handleSignOut}>
              Cerrar sesión
            </button>
          </div>
        )}
      </header>

      <div className={environmentClass}>
        {environmentLabel}
      </div>
      {(user?.canReview || user?.canManageDraftJourneys || user?.canManageUsers || user?.canManageCatalog) && (
        <nav className="workspace-nav" aria-label="Secciones de Maestro">
          <button
            className={activeSection === "MONITOR" ? "workspace-tab workspace-tab--active" : "workspace-tab"}
            type="button"
            onClick={() => setActiveSection("MONITOR")}
          >
            Conteos
          </button>
          <button
            className={activeSection === "MAP" ? "workspace-tab workspace-tab--active" : "workspace-tab"}
            type="button"
            onClick={() => {
              setReviewDialog(undefined);
              setReassignmentDialog(undefined);
              setReleaseDialog(undefined);
              setActiveSection("MAP");
            }}
          >
            Mapa
          </button>
          {user.canReview && (
            <button
              className={activeSection === "DISCARDS" ? "workspace-tab workspace-tab--active" : "workspace-tab"}
              type="button"
              onClick={() => {
                setReviewDialog(undefined);
                setReassignmentDialog(undefined);
                setReleaseDialog(undefined);
                setActiveSection("DISCARDS");
              }}
            >
              Descartes
            </button>
          )}
          <button
            className={activeSection === "JOURNEYS" ? "workspace-tab workspace-tab--active" : "workspace-tab"}
            type="button"
            onClick={() => {
              setReviewDialog(undefined);
              setReassignmentDialog(undefined);
              setReleaseDialog(undefined);
              setActiveSection("JOURNEYS");
            }}
          >
            Jornadas
          </button>
          {user.canReview && (
            <button
              className={activeSection === "REPORTS" ? "workspace-tab workspace-tab--active" : "workspace-tab"}
              type="button"
              onClick={() => {
                setReviewDialog(undefined);
                setReassignmentDialog(undefined);
                setReleaseDialog(undefined);
                setActiveSection("REPORTS");
              }}
            >
              Informes
            </button>
          )}
          {user.canManageUsers && (
            <button
              className={activeSection === "USERS" ? "workspace-tab workspace-tab--active" : "workspace-tab"}
              type="button"
              onClick={() => {
                setReviewDialog(undefined);
                setReassignmentDialog(undefined);
                setReleaseDialog(undefined);
                setActiveSection("USERS");
              }}
            >
              Usuarios
            </button>
          )}
          {user.canManageCatalog && (
            <button
              className={activeSection === "CATALOG" ? "workspace-tab workspace-tab--active" : "workspace-tab"}
              type="button"
              onClick={() => {
                setReviewDialog(undefined);
                setReassignmentDialog(undefined);
                setReleaseDialog(undefined);
                setActiveSection("CATALOG");
              }}
            >
              Catálogo
            </button>
          )}
          {user.role === "ADMINISTRADOR" && (
            <button
              className={activeSection === "MIGRATION" ? "workspace-tab workspace-tab--active" : "workspace-tab"}
              type="button"
              onClick={() => {
                setReviewDialog(undefined);
                setReassignmentDialog(undefined);
                setReleaseDialog(undefined);
                setActiveSection("MIGRATION");
              }}
            >
              Migración — Validación
            </button>
          )}
        </nav>
      )}

      {!user ? (
        <section className="login-panel" aria-labelledby="login-title">
          <p className="eyebrow">ETAPA 20</p>
          <h1 id="login-title">Acceso a revisión</h1>
          <p>
            {production
              ? "Use una cuenta autorizada de Vivero Maestro."
              : "Use una cuenta cargada en Firebase Authentication Emulator."}
          </p>
          <form onSubmit={handleSignIn}>
            <label>
              Correo
              <input autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Contraseña
              <input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {error && <p className="alert" role="alert">{error}</p>}
            <button className="button" type="submit" disabled={loading || repository.environment === "DISABLED"}>
              {loading ? "Ingresando…" : "Iniciar sesión"}
            </button>
          </form>
        </section>
      ) : activeSection === "DISCARDS" && user.canReview ? (
        <DiscardsSection repository={repository} user={user} />
      ) : activeSection === "USERS" && user.canManageUsers ? (
        <UsersSection repository={repository} currentUser={user} />
      ) : activeSection === "REPORTS" && user.canReview ? (
        <InventoryReportsSection repository={repository} currentUser={user} platform={reportPlatform} />
      ) : activeSection === "MAP" ? (
        <ModuleMapSection
          snapshot={snapshot}
          loading={loading}
          journeys={journeys}
          selectedJourneyId={selectedJourneyId}
          onSelectJourney={(journeyId) => startMonitoring(user, journeyId)}
        />
      ) : activeSection === "CATALOG" && user.canManageCatalog ? (
        <CatalogSection
          repository={repository}
          onCatalogChanged={() => setDraftRefreshVersion((version) => version + 1)}
        />
      ) : activeSection === "MIGRATION" && user.role === "ADMINISTRADOR" ? (
        <MigrationValidationSection repository={repository} />
      ) : activeSection === "JOURNEYS" ? (
        <DraftJourneysSection
          key={draftRefreshVersion}
          repository={repository}
          user={user}
          onActiveJourneysChanged={refreshActiveJourneys}
        />
      ) : (
        <section className="monitor" aria-labelledby="monitor-title">
          <div className="monitor-filters">
            <label>
              Jornada activa
              <select
                aria-label="Jornada activa"
                value={selectedJourneyId ?? ""}
                disabled={reviewing || reassigning || releasing || closing}
                onChange={(event) => {
                  if (user && event.target.value) startMonitoring(user, event.target.value);
                }}
              >
                <option value="">Seleccionar jornada</option>
                {journeys.map((journey) => (
                  <option key={journey.id} value={journey.id}>
                    {journey.displayName} · {journey.lineCount} líneas
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="monitor-heading">
            <div>
              <p className="eyebrow">BANDEJA DE REVISIÓN</p>
              <h1 id="monitor-title">
                {snapshot?.journeyDisplayName ?? (selectedJourneyId ? "Cargando jornada…" : "Selecciona una jornada activa")}
              </h1>
            </div>
            {selectedJourneyId && <span className="live-indicator"><i aria-hidden="true" /> Actualización en vivo</span>}
          </div>

          {canCloseSelectedJourney && selectedJourney && (
            <section className="journey-close-panel" aria-label="Cierre seguro de jornada">
              <div>
                <strong>Cierre seguro</strong>
                <span>{approvedCount} aprobada(s) · {pendingCount} pendiente(s)</span>
                <span>
                  Estados: {Object.entries(closeStateCounts).map(([state, count]) => `${state} ${count}`).join(" · ") || "sin líneas"}
                </span>
              </div>
              <button
                className="button"
                type="button"
                disabled={closeBlockers.length > 0 || closing}
                onClick={() => {
                  setError(undefined);
                  setNotice(undefined);
                  setCloseDialog({idempotencyKey: crypto.randomUUID(), attempted: false});
                }}
              >
                Cerrar jornada
              </button>
              {closeBlockers.length > 0 && (
                <ul className="close-blockers">
                  {closeBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                </ul>
              )}
            </section>
          )}

          {error && <p className="alert" role="alert">{error}</p>}
          {notice && <p className="notice" role="status">{notice}</p>}
          <div className="monitor-filters">
            <label>
              Buscar ubicación
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Vivero, módulo, cama o línea" />
            </label>
            <label>
              Estado
              <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
                <option value="TODOS">Todos</option>
                <option value="PENDIENTE_REVISION">Pendiente de revisión</option>
                <option value="DEVUELTA">Devuelta</option>
                <option value="APROBADA">Aprobada</option>
                <option value="DISPONIBLE">Disponible</option>
                <option value="EN_CONTEO">En conteo</option>
              </select>
            </label>
          </div>
          {!selectedJourneyId ? (
            <p className="empty-state">Selecciona una jornada para consultar sus líneas.</p>
          ) : !snapshot ? (
            <p className="empty-state">Esperando datos de la jornada…</p>
          ) : visibleLines.length === 0 ? (
            <p className="empty-state">No hay líneas que coincidan con el filtro.</p>
          ) : (
            <div className="line-grid" aria-label="Líneas de la jornada">
              {visibleLines.map((line) => {
                const count = line.count;
                const inventory = line.inventory;
                const ownCount = count?.authorUserId === user.id;
                const supervisorOwnApproval = ownCount && user.role === "SUPERVISOR";
                return (
                  <article className="line-card" key={line.id}>
                    <div>
                      <span className={`state state--${line.state.toLowerCase()}`}>{line.state.replaceAll("_", " ")}</span>
                      <h2>{line.location.displayName}</h2>
                      <p>{line.location.nursery} · {line.location.module} · {line.location.bed}</p>
                    </div>
                    {line.state === "EN_CONTEO" && (
                      user.canViewReservationDetails && line.reservation ? (
                        <dl className="reservation-detail">
                          <div><dt>Reservada por</dt><dd>{line.reservation.userDisplayName}</dd></div>
                          <div><dt>Tipo</dt><dd>{line.reservation.type === "CORRECCION" ? "Corrección" : "Normal"}</dd></div>
                          <div><dt>Dispositivo</dt><dd>{line.reservation.deviceId}</dd></div>
                          <div><dt>Desde</dt><dd>{formatTime(line.reservation.reservedAt)}</dd></div>
                          <div><dt>Versión de línea</dt><dd>{line.version}</dd></div>
                          {user.canRelease && (
                            <div className="review-actions">
                              <button className="button" type="button" onClick={() => openRelease(line)}>
                                Liberar reserva
                              </button>
                            </div>
                          )}
                        </dl>
                      ) : <p className="reservation-private">Reserva activa</p>
                    )}
                    {line.state === "PENDIENTE_REVISION" && (
                      user.canViewReservationDetails && count ? (
                        <>
                          <dl className="count-detail">
                            <div><dt>Autor</dt><dd>{count.authorDisplayName} · {count.effectiveRole}</dd></div>
                            <div><dt>Dispositivo</dt><dd>{count.deviceId}</dd></div>
                            <div><dt>Hembras</dt><dd>{count.females}</dd></div>
                            <div><dt>Machos</dt><dd>{count.males}</dd></div>
                            <div><dt>Patrones</dt><dd>{count.rootstocks}</dd></div>
                            {count.deadPlants !== undefined && <div><dt>Plantas muertas</dt><dd>{count.deadPlants}</dd></div>}
                            <div><dt>Total</dt><dd><strong>{count.total}</strong></dd></div>
                            <div><dt>Observaciones</dt><dd>{count.observations ?? "Sin observaciones"}</dd></div>
                            <div><dt>Hora dispositivo</dt><dd>{formatTime(count.deviceTimestamp)}</dd></div>
                            <div><dt>Hora servidor</dt><dd>{formatTime(count.serverTimestamp)}</dd></div>
                            <div><dt>Versión</dt><dd>{count.version}</dd></div>
                            <div><dt>Inventario actual</dt><dd>{inventory?.total ?? "No disponible"}</dd></div>
                            <div><dt>Diferencia total</dt><dd>{inventory ? signed(count.total - inventory.total) : "—"}</dd></div>
                          </dl>
                          {user.canReview && (
                            <div className="review-actions">
                              <button
                                className="button"
                                type="button"
                                disabled={!inventory || supervisorOwnApproval}
                                onClick={() => openReview("APPROVE", line)}
                              >
                                Aprobar
                              </button>
                              <button className="button button--secondary" type="button" onClick={() => openReview("RETURN", line)}>
                                Devolver
                              </button>
                            </div>
                          )}
                          {supervisorOwnApproval && <p className="warning">Un supervisor no puede aprobar su propio conteo.</p>}
                          {!inventory && <p className="warning">No se puede aprobar sin inventario oficial inicial.</p>}
                        </>
                      ) : <p className="reservation-private">Conteo pendiente de revisión · detalle restringido</p>
                    )}
                    {line.state === "DEVUELTA" && count && user.canViewReservationDetails && (
                      <section className="correction-responsibility" aria-label={`Responsabilidad de corrección de ${line.location.displayName}`}>
                        <h3>Corrección pendiente</h3>
                        <span>Autor original: {line.correctionResponsibility?.originalAuthorDisplayName ?? count.authorDisplayName}</span>
                        <span>
                          Responsable actual: {line.correctionResponsibility?.responsibleDisplayName ?? count.authorDisplayName}
                        </span>
                        <span>Motivo de devolución: {count.returnReason ?? "No disponible"}</span>
                        {line.correctionResponsibility && (
                          <>
                            <span>Asignada por: {line.correctionResponsibility.assignedByDisplayName}</span>
                            <span>Motivo de reasignación: {line.correctionResponsibility.reason}</span>
                            <span>Hora: {formatTime(line.correctionResponsibility.assignedAt)}</span>
                          </>
                        )}
                        {user.canReview && (
                          <button className="button" type="button" onClick={() => openReassignment(line)}>
                            Reasignar corrección
                          </button>
                        )}
                      </section>
                    )}
                    {user.canViewReservationDetails && (line.countHistory?.length ?? 0) > 0 && (
                      <section className="count-history" aria-label={`Historial de versiones de ${line.location.displayName}`}>
                        <h3>Historial de versiones</h3>
                        {line.countHistory?.map((version) => (
                          <article className="count-version" key={version.id}>
                            <strong>
                              Versión {version.version}
                              {version.id === line.count?.id ? " · Vigente" : " · Anterior inmutable"}
                            </strong>
                            <span>
                              Hembras {version.females} · Machos {version.males} · Patrones {version.rootstocks} · Total {version.total}
                            </span>
                            {version.deadPlants !== undefined && <span>Plantas muertas {version.deadPlants} · No forman parte del total vivo</span>}
                            <span>Observaciones: {version.observations ?? "Sin observaciones"}</span>
                            {version.returnReason && <span>Motivo de devolución: {version.returnReason}</span>}
                          </article>
                        ))}
                      </section>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          <p className="read-only-note">
            Los conteos son inmutables: Maestro solo solicita aprobar o devolver al backend transaccional. No edita conteos ni inventario directamente.
          </p>
        </section>
      )}

      {activeSection === "MONITOR" && reviewDialog?.line.count && user && (
        <div className="dialog-backdrop" role="presentation">
          <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title">
            <p className="eyebrow">CONFIRMACIÓN CENTRAL</p>
            <h2 id="review-title">{reviewDialog.kind === "APPROVE" ? "Aprobar conteo" : "Devolver conteo"}</h2>
            <p>{reviewDialog.line.location.nursery} · {reviewDialog.line.location.module} · {reviewDialog.line.location.bed} · {reviewDialog.line.location.line}</p>
            {reviewDialog.kind === "APPROVE" && reviewDialog.line.inventory ? (
              <div className="inventory-summary" aria-label="Resumen de aprobación">
                <strong>Inventario anterior → Conteo nuevo → Diferencia</strong>
                <span>Hembras: {reviewDialog.line.inventory.females} → {reviewDialog.line.count.females} → {signed(reviewDialog.line.count.females - reviewDialog.line.inventory.females)}</span>
                <span>Machos: {reviewDialog.line.inventory.males} → {reviewDialog.line.count.males} → {signed(reviewDialog.line.count.males - reviewDialog.line.inventory.males)}</span>
                <span>Patrones: {reviewDialog.line.inventory.rootstocks} → {reviewDialog.line.count.rootstocks} → {signed(reviewDialog.line.count.rootstocks - reviewDialog.line.inventory.rootstocks)}</span>
                <span>Total: {reviewDialog.line.inventory.total} → {reviewDialog.line.count.total} → {signed(reviewDialog.line.count.total - reviewDialog.line.inventory.total)}</span>
              </div>
            ) : (
              <div className="inventory-summary">
                <span>Conteo total: {reviewDialog.line.count.total}</span>
                <span>El conteo original no será editado.</span>
              </div>
            )}
            {reviewDialog.kind === "APPROVE" && reviewDialog.line.count.authorUserId === user.id && user.role === "ADMINISTRADOR" && (
              <p className="warning">Advertencia: aprobarás excepcionalmente tu propio conteo. El motivo quedará auditado.</p>
            )}
            {(reviewDialog.kind === "RETURN" || (reviewDialog.line.count.authorUserId === user.id && user.role === "ADMINISTRADOR")) && (
              <label>
                {reviewDialog.kind === "RETURN" ? "Motivo de devolución" : "Motivo de la excepción"}
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={reviewDialog.reason}
                  onChange={(event) => updateReviewReason(event.target.value)}
                />
              </label>
            )}
            <div className="dialog-actions">
              <button className="button button--secondary" type="button" disabled={reviewing} onClick={() => setReviewDialog(undefined)}>
                Cancelar
              </button>
              <button className="button" type="button" disabled={reviewing} onClick={submitReview}>
                {reviewing ? "Procesando…" : reviewDialog.kind === "APPROVE" ? "Confirmar aprobación" : "Confirmar devolución"}
              </button>
            </div>
          </section>
        </div>
      )}

      {activeSection === "MONITOR" && reassignmentDialog?.line.count && user && (
        <div className="dialog-backdrop" role="presentation">
          <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="reassignment-title">
            <p className="eyebrow">REASIGNACIÓN SUPERVISADA</p>
            <h2 id="reassignment-title">Reasignar corrección</h2>
            <p>
              {reassignmentDialog.line.location.nursery} · {reassignmentDialog.line.location.module} · {reassignmentDialog.line.location.bed} · {reassignmentDialog.line.location.line}
            </p>
            {!reassignmentDialog.showSummary ? (
              <>
                <label>
                  Nuevo responsable
                  <select
                    value={reassignmentDialog.targetUserId}
                    onChange={(event) => updateReassignment({targetUserId: event.target.value})}
                  >
                    <option value="">Seleccionar usuario</option>
                    {(snapshot?.correctionCandidates ?? []).filter((candidate) => {
                      const currentResponsible = reassignmentDialog.line.correctionResponsibility?.responsibleUserId ??
                        reassignmentDialog.line.count?.authorUserId;
                      return candidate.id !== currentResponsible;
                    }).map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{candidate.displayName} · {candidate.role}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Motivo obligatorio
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={reassignmentDialog.reason}
                    onChange={(event) => updateReassignment({reason: event.target.value})}
                  />
                </label>
              </>
            ) : (
              <div className="inventory-summary" aria-label="Resumen de reasignación">
                <strong>Confirma la reasignación</strong>
                <span>Autor original: {reassignmentDialog.line.count.authorDisplayName}</span>
                <span>
                  Responsable actual: {reassignmentDialog.line.correctionResponsibility?.responsibleDisplayName ?? reassignmentDialog.line.count.authorDisplayName}
                </span>
                <span>
                  Nuevo responsable: {(snapshot?.correctionCandidates ?? []).find((candidate) => candidate.id === reassignmentDialog.targetUserId)?.displayName}
                </span>
                <span>Motivo: {reassignmentDialog.reason}</span>
                <span>El conteo original y su autor permanecerán intactos.</span>
              </div>
            )}
            <div className="dialog-actions">
              <button className="button button--secondary" type="button" disabled={reassigning} onClick={() => setReassignmentDialog(undefined)}>
                Cancelar
              </button>
              {reassignmentDialog.showSummary ? (
                <button className="button" type="button" disabled={reassigning} onClick={submitReassignment}>
                  {reassigning ? "Procesando…" : "Confirmar reasignación"}
                </button>
              ) : (
                <button className="button" type="button" onClick={reviewReassignment}>Revisar reasignación</button>
              )}
            </div>
          </section>
        </div>
      )}

      {activeSection === "MONITOR" && releaseDialog?.line.reservation && user && (
        <div className="dialog-backdrop" role="presentation">
          <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="release-title">
            <p className="eyebrow">DECISIÓN HUMANA SUPERVISADA</p>
            <h2 id="release-title">Liberar reserva</h2>
            <p>
              {releaseDialog.line.location.nursery} · {releaseDialog.line.location.module} · {releaseDialog.line.location.bed} · {releaseDialog.line.location.line}
            </p>
            {!releaseDialog.showSummary ? (
              <>
                <dl className="reservation-detail">
                  <div><dt>Titular</dt><dd>{releaseDialog.line.reservation.userDisplayName}</dd></div>
                  <div><dt>Dispositivo</dt><dd>{releaseDialog.line.reservation.deviceId}</dd></div>
                  <div><dt>Tipo</dt><dd>{releaseDialog.line.reservation.type === "CORRECCION" ? "Corrección" : "Normal"}</dd></div>
                  <div><dt>Versión de línea</dt><dd>{releaseDialog.line.version}</dd></div>
                </dl>
                <p className="warning">
                  Puede existir un borrador local sin enviar. La liberación no lo elimina ni recupera su contenido.
                </p>
                <label>
                  Motivo obligatorio
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={releaseDialog.reason}
                    onChange={(event) => updateReleaseReason(event.target.value)}
                  />
                </label>
              </>
            ) : (
              <div className="inventory-summary" aria-label="Resumen de liberación">
                <strong>Confirma la liberación manual</strong>
                <span>Titular: {releaseDialog.line.reservation.userDisplayName}</span>
                <span>Motivo: {releaseDialog.reason}</span>
                <span>
                  Estado resultante: {releaseDialog.line.reservation.type === "CORRECCION" ? "DEVUELTA" : "DISPONIBLE"}
                </span>
                <span>El borrador, la reserva y el historial no serán eliminados.</span>
              </div>
            )}
            <div className="dialog-actions">
              <button className="button button--secondary" type="button" disabled={releasing} onClick={() => setReleaseDialog(undefined)}>
                Cancelar
              </button>
              {releaseDialog.showSummary ? (
                <button className="button" type="button" disabled={releasing} onClick={submitRelease}>
                  {releasing ? "Procesando…" : "Confirmar liberación"}
                </button>
              ) : (
                <button className="button" type="button" disabled={releasing} onClick={reviewRelease}>
                  Revisar liberación
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {activeSection === "MONITOR" && closeDialog && selectedJourney && snapshot && user && (
        <div className="dialog-backdrop" role="presentation">
          <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="close-journey-title">
            <p className="eyebrow">CIERRE TRANSACCIONAL</p>
            <h2 id="close-journey-title">Cerrar jornada</h2>
            <div className="inventory-summary" aria-label="Resumen del cierre">
              <strong>{selectedJourney.displayName}</strong>
              {selectedJourney.configuracionInformeInventario ? (
                <>
                  <strong>Informe de inventario</strong>
                  <span>
                    {selectedJourney.configuracionInformeInventario.habilitado ? "Habilitado" : "Deshabilitado"}
                    {selectedJourney.configuracionInformeInventario.habilitado
                      ? ` · ${selectedJourney.configuracionInformeInventario.mes}/${selectedJourney.configuracionInformeInventario.anio}`
                      : ""}
                  </span>
                  <span>
                    Fuente de plantas muertas: {selectedJourney.configuracionInformeInventario.fuentePlantasMuertas === "CONTEO_FISICO"
                      ? "Conteo físico"
                      : "Descartes aprobados"}
                  </span>
                  <span>Al cerrar se creará el trabajo central para generar y subir el informe.</span>
                  {selectedJourney.configuracionInformeInventario.fuentePlantasMuertas === "DESCARTES_APROBADOS" && (
                    <span>Descartes pendientes: {selectedJourney.cantidadDescartesPendientes ?? 0}</span>
                  )}
                </>
              ) : <span>Informe de inventario: sin configuración.</span>}
              <span>Líneas aprobadas: {approvedCount}</span>
              <span>Líneas pendientes: {pendingCount}</span>
              <span>Reservas activas: {activeReservationCount}</span>
              <span>Correcciones o reasignaciones pendientes: {pendingCorrectionCount}</span>
              {Object.entries(closeStateCounts).map(([state, count]) => (
                <span key={state}>{state.replaceAll("_", " ")}: {count}</span>
              ))}
            </div>
            <p className="warning">
              Al confirmar, esta jornada dejará de estar disponible en Vivero Campo. El historial local y central no se eliminará.
            </p>
            <label className="explicit-confirmation">
              <input
                type="checkbox"
                checked={closeDialog.attempted}
                disabled={closing}
                onChange={(event) => setCloseDialog({...closeDialog, attempted: event.target.checked})}
              />
              Confirmo que deseo cerrar esta jornada.
            </label>
            <div className="dialog-actions">
              <button className="button button--secondary" type="button" disabled={closing} onClick={() => setCloseDialog(undefined)}>
                Cancelar
              </button>
              <button className="button" type="button" disabled={closing || !closeDialog.attempted} onClick={submitCloseJourney}>
                {closing ? "Cerrando..." : "Confirmar cierre"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
