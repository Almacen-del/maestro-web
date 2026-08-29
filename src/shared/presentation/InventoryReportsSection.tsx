import {useEffect, useMemo, useRef, useState} from "react";

import type {
  GoogleDriveConnectionStatus,
  GoogleDriveSelectionKind,
  InventoryReportStatus,
  InventoryReportSummary,
  MonitorRepository,
  MonitorUser,
} from "../domain/MonitorModels";

interface InventoryReportsSectionProps {
  readonly repository: MonitorRepository;
  readonly currentUser: MonitorUser;
  readonly platform?: ReportPlatform;
}

export interface ReportPlatform {
  readonly desktopOAuth: boolean;
  readonly openExternalUrl: (url: string) => Promise<boolean>;
}

const statusLabels: Record<InventoryReportStatus, string> = {
  PENDIENTE: "Pendiente",
  PROCESANDO: "Procesando",
  COMPLETADO: "Completado",
  ERROR_REINTENTABLE: "Error reintentable",
  ERROR_PERMANENTE: "Error permanente",
};

function formatTime(value: string | undefined): string {
  if (!value) return "No disponible";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("es-CO", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Bogota",
      }).format(date);
}

const driveStateLabels: Record<GoogleDriveConnectionStatus["state"], string> = {
  NO_CONFIGURADO: "No configurado",
  CONECTADO_INCOMPLETO: "Conectado, seleccion incompleta",
  LISTO: "Listo para generar informes",
  REVOCADO: "Autorizacion revocada",
  REQUIERE_RECONEXION: "Requiere reconexion",
};

export function InventoryReportsSection({repository, currentUser, platform}: InventoryReportsSectionProps) {
  const desktopOAuth = platform?.desktopOAuth ?? true;
  const [reports, setReports] = useState<readonly InventoryReportSummary[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [loading, setLoading] = useState(true);
  const [retryingJourneyId, setRetryingJourneyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [driveStatus, setDriveStatus] = useState<GoogleDriveConnectionStatus>();
  const [driveBusy, setDriveBusy] = useState(false);
  const retryKeys = useRef(new Map<string, string>());

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await repository.listInventoryReports();
      setReports(result.informes);
      setError(undefined);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar los informes de inventario.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    if (currentUser.role === "ADMINISTRADOR") {
      void repository.getGoogleDriveConnectionStatus()
        .then(setDriveStatus)
        .catch((statusError: unknown) => {
          setError(statusError instanceof Error ? statusError.message : "No fue posible consultar Google Drive.");
        });
    }
  }, []);

  const connectDrive = async (
    selectionKind: GoogleDriveSelectionKind,
    reconnect = false,
  ): Promise<void> => {
    if (!desktopOAuth || currentUser.role !== "ADMINISTRADOR" || driveBusy) return;
    if (reconnect && !window.confirm(
      "Se revocara la autorizacion actual y deberas seleccionar nuevamente plantilla y carpeta. ¿Continuar?",
    )) return;
    const desktop = window.viveroFoundation;
    if (!desktop?.prepareGoogleDriveOAuth || !desktop.openGoogleDriveOAuth) {
      setError("La conexion segura con el navegador del sistema no esta disponible.");
      return;
    }
    setDriveBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      if (reconnect) {
        const revoked = await repository.revokeGoogleDriveOAuth(crypto.randomUUID());
        setDriveStatus(revoked);
      }
      const preparation = await desktop.prepareGoogleDriveOAuth();
      const start = await repository.startGoogleDriveOAuth({
        selectionKind,
        redirectUri: preparation.redirectUri,
        codeChallenge: preparation.codeChallenge,
        idempotencyKey: crypto.randomUUID(),
      });
      const callback = await desktop.openGoogleDriveOAuth(preparation.localSessionId, start.authorizationUrl);
      if (!callback.ok) {
        throw new Error(callback.errorCode === "CANCELLED"
          ? "La autorizacion fue cancelada."
          : callback.errorCode === "EXPIRED"
            ? "La autorizacion expiro. Inicia el proceso de nuevo."
            : "Google devolvio una respuesta de autorizacion no valida.");
      }
      const status = await repository.completeGoogleDriveOAuth(callback);
      setDriveStatus(status);
      setNotice(selectionKind === "PLANTILLA"
        ? "Plantilla autorizada mediante Google Picker."
        : "Carpeta de salida autorizada mediante Google Picker.");
    } catch (connectionError) {
      setError(connectionError instanceof Error
        ? connectionError.message : "No fue posible conectar Google Drive.");
    } finally {
      setDriveBusy(false);
    }
  };

  const revokeDrive = async (): Promise<void> => {
    if (
      currentUser.role !== "ADMINISTRADOR" || driveBusy ||
      !window.confirm("Se revocara el acceso de Vivero Maestro a Google Drive. ¿Continuar?")
    ) return;
    setDriveBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const status = await repository.revokeGoogleDriveOAuth(crypto.randomUUID());
      setDriveStatus(status);
      setNotice("La autorizacion de Google Drive fue revocada.");
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "No fue posible revocar Google Drive.");
    } finally {
      setDriveBusy(false);
    }
  };

  const visibleReports = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return reports.filter((report) =>
      (statusFilter === "TODOS" || report.estado === statusFilter) &&
      `${report.jornadaNombreVisible} ${report.archivoNombre ?? ""} ${report.errorCodigo ?? ""}`
        .toLocaleLowerCase("es")
        .includes(term)
    );
  }, [reports, search, statusFilter]);

  const retry = async (report: InventoryReportSummary): Promise<void> => {
    if (report.estado !== "ERROR_REINTENTABLE" || retryingJourneyId) return;
    setRetryingJourneyId(report.jornadaId);
    setError(undefined);
    setNotice(undefined);
    const key = retryKeys.current.get(report.jornadaId) ?? crypto.randomUUID();
    retryKeys.current.set(report.jornadaId, key);
    try {
      await repository.retryInventoryReport({jornadaId: report.jornadaId, claveIdempotencia: key});
      retryKeys.current.delete(report.jornadaId);
      await load();
      setNotice("Reintento solicitado de forma idempotente.");
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "No fue posible reintentar el informe.");
    } finally {
      setRetryingJourneyId(undefined);
    }
  };

  const openReport = async (report: InventoryReportSummary): Promise<void> => {
    if (!report.archivoEnlace) return;
    setError(undefined);
    const openExternalUrl = platform?.openExternalUrl ?? window.viveroFoundation?.openExternalUrl;
    if (!openExternalUrl) {
      setError("La apertura segura del archivo no está disponible en esta instalación.");
      return;
    }
    try {
      const opened = await openExternalUrl(report.archivoEnlace);
      if (!opened) setError("El enlace del informe no pertenece a un destino permitido.");
    } catch {
      setError("No fue posible abrir el informe de forma segura.");
    }
  };

  return (
    <section className="monitor inventory-reports" aria-labelledby="inventory-reports-title">
      <div className="monitor-heading">
        <div>
          <p className="eyebrow">INFORMES CENTRALIZADOS</p>
          <h1 id="inventory-reports-title">Informes de inventario</h1>
          <p>Maestro consulta el estado central. No accede directamente a Google Drive.</p>
        </div>
        <button className="button button--secondary" type="button" disabled={loading} onClick={() => void load()}>
          Actualizar
        </button>
      </div>

      {error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}

      {currentUser.role === "ADMINISTRADOR" && (
        <section className="drive-connection-panel" aria-labelledby="drive-connection-title">
          <div>
            <p className="eyebrow">ACCESO LIMITADO DRIVE.FILE</p>
            <h2 id="drive-connection-title">Google Drive</h2>
            <strong>{driveStatus ? driveStateLabels[driveStatus.state] : "Consultando estado..."}</strong>
            <span>Plantilla: {driveStatus?.templateName ?? "Sin seleccionar"}</span>
            <span>Carpeta de salida: {driveStatus?.folderName ?? "Sin seleccionar"}</span>
            <small>{desktopOAuth
              ? "La autorizacion se abre en el navegador del sistema. Los tokens nunca se muestran."
              : "Conectar, seleccionar recursos y reconectar Google Drive requieren Vivero Maestro para Windows. OAuth web está pendiente; los informes y la revocación siguen disponibles."}</small>
          </div>
          <div className="review-actions">
            {desktopOAuth && <button className="button" type="button" disabled={driveBusy} onClick={() => void connectDrive("PLANTILLA")}>
              {driveStatus?.state === "NO_CONFIGURADO" || !driveStatus ? "Conectar Google Drive" : "Seleccionar plantilla"}
            </button>}
            {desktopOAuth && <button className="button button--secondary" type="button" disabled={driveBusy} onClick={() => void connectDrive("CARPETA_SALIDA")}>
              Seleccionar carpeta de salida
            </button>}
            {driveStatus && driveStatus.state !== "NO_CONFIGURADO" && driveStatus.state !== "REVOCADO" && (
              <>
                {desktopOAuth && <button className="button button--secondary" type="button" disabled={driveBusy} onClick={() => void connectDrive("PLANTILLA", true)}>
                  Reconectar
                </button>}
                <button className="button button--danger" type="button" disabled={driveBusy} onClick={() => void revokeDrive()}>
                  Revocar autorizacion
                </button>
              </>
            )}
          </div>
        </section>
      )}

      <div className="monitor-filters">
        <label>
          Buscar informe
          <input
            aria-label="Buscar informe"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Jornada, archivo o código de error"
          />
        </label>
        <label>
          Estado
          <select aria-label="Filtrar informes por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="TODOS">Todos</option>
            {Object.entries(statusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
          </select>
        </label>
      </div>

      {loading ? <p className="empty-state">Cargando informes…</p> : visibleReports.length === 0 ? (
        <p className="empty-state">No hay informes que coincidan con el filtro.</p>
      ) : (
        <div className="report-grid" aria-label="Informes de inventario">
          {visibleReports.map((report) => (
            <article className="report-card" key={report.informeId}>
              <div className="report-card-heading">
                <div>
                  <span className={`state report-state report-state--${report.estado.toLocaleLowerCase("es")}`}>
                    {statusLabels[report.estado]}
                  </span>
                  <h2>{report.jornadaNombreVisible}</h2>
                </div>
                <strong>{report.mes}/{report.anio}</strong>
              </div>
              <dl className="count-detail">
                <div><dt>Fuente de plantas muertas</dt><dd>{report.fuentePlantasMuertas === "CONTEO_FISICO" ? "Conteo físico" : "Descartes aprobados"}</dd></div>
                <div><dt>Intentos</dt><dd>{report.intentos}</dd></div>
                <div><dt>Creado</dt><dd>{formatTime(report.creadoEn)}</dd></div>
                <div><dt>Actualizado</dt><dd>{formatTime(report.actualizadoEn)}</dd></div>
                <div><dt>Finalizado</dt><dd>{formatTime(report.finalizadoEn)}</dd></div>
                {report.archivoNombre && <div><dt>Archivo</dt><dd>{report.archivoNombre}</dd></div>}
                {report.errorCodigo && <div><dt>Código</dt><dd>{report.errorCodigo}</dd></div>}
                {report.errorMensaje && <div><dt>Detalle</dt><dd>{report.errorMensaje}</dd></div>}
              </dl>
              <div className="review-actions">
                {report.estado === "COMPLETADO" && report.archivoEnlace && (
                  <button className="button" type="button" onClick={() => void openReport(report)}>
                    Abrir archivo
                  </button>
                )}
                {report.estado === "ERROR_REINTENTABLE" && (
                  <button
                    className="button"
                    type="button"
                    disabled={retryingJourneyId !== undefined}
                    onClick={() => void retry(report)}
                  >
                    {retryingJourneyId === report.jornadaId ? "Reintentando…" : "Reintentar"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
