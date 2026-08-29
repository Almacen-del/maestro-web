import {useEffect, useState} from "react";

import type {
  MigrationValidationEntity,
  MigrationValidationIssue,
  MigrationImportResult,
  MigrationImportSummary,
  MigrationValidationReport,
  MonitorRepository,
} from "../domain/MonitorModels";

interface MigrationValidationSectionProps {
  readonly repository: MonitorRepository;
}

const MAX_FILE_BYTES = 512_000;
const ROOT_FIELDS = new Set(["formato", "metadatos", "ubicaciones", "lineas", "inventariosIniciales"]);
const IMPORT_MAX_WRITES = 450;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateLocalMigrationPackage(value: unknown, size: number): string | undefined {
  if (size > MAX_FILE_BYTES) return "El archivo supera el máximo técnico de 512.000 bytes.";
  if (!isRecord(value)) return "El archivo debe contener un objeto JSON.";
  const extras = Object.keys(value).filter((field) => !ROOT_FIELDS.has(field));
  if (extras.length > 0) return `El archivo contiene campos raíz no permitidos: ${extras.join(", ")}.`;
  if (value.formato !== "paquete-migracion-catalogo-v1") {
    return "El formato debe ser paquete-migracion-catalogo-v1.";
  }
  if (!isRecord(value.metadatos) || !Array.isArray(value.ubicaciones) ||
      !Array.isArray(value.lineas) || !Array.isArray(value.inventariosIniciales)) {
    return "Faltan metadatos o listas obligatorias del formato v1.";
  }
  return undefined;
}

export function projectedMigrationWrites(report: MigrationValidationReport): number {
  return 2 * (report.counts.locations + report.counts.lines + report.counts.initialInventories) + 4;
}

function entityLabel(entity: MigrationValidationEntity): string {
  return {
    PAQUETE: "Paquete",
    UBICACION: "Ubicación",
    LINEA: "Línea",
    INVENTARIO_INICIAL: "Inventario inicial",
  }[entity];
}

export function MigrationValidationSection({repository}: MigrationValidationSectionProps) {
  const [packageData, setPackageData] = useState<unknown>();
  const [fileName, setFileName] = useState<string>();
  const [localCounts, setLocalCounts] = useState<{locations: number; lines: number; inventories: number}>();
  const [report, setReport] = useState<MigrationValidationReport>();
  const [error, setError] = useState<string>();
  const [validating, setValidating] = useState(false);
  const [severityFilter, setSeverityFilter] = useState("TODAS");
  const [entityFilter, setEntityFilter] = useState("TODAS");
  const [hashConfirmation, setHashConfirmation] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<MigrationImportResult>();
  const [history, setHistory] = useState<readonly MigrationImportSummary[]>([]);
  const [historyError, setHistoryError] = useState<string>();
  const [reversalTarget, setReversalTarget] = useState<MigrationImportSummary>();
  const [reversalReason, setReversalReason] = useState("");
  const [reverting, setReverting] = useState(false);
  const [operationMessage, setOperationMessage] = useState<string>();

  const refreshHistory = async () => {
    try {
      setHistory(await repository.listMigrationImports());
      setHistoryError(undefined);
    } catch (historyFailure) {
      setHistoryError(historyFailure instanceof Error ? historyFailure.message : "No fue posible consultar el historial.");
    }
  };

  useEffect(() => {
    void refreshHistory();
  }, []);

  const selectFile = async (file: File | undefined) => {
    setPackageData(undefined);
    setFileName(undefined);
    setLocalCounts(undefined);
    setReport(undefined);
    setImportResult(undefined);
    setHashConfirmation("");
    setOperationMessage(undefined);
    setError(undefined);
    if (!file) return;
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const localError = validateLocalMigrationPackage(parsed, new TextEncoder().encode(text).length);
      if (localError) {
        setError(localError);
        return;
      }
      const root = parsed as Record<string, unknown>;
      setPackageData(parsed);
      setFileName(file.name);
      setLocalCounts({
        locations: (root.ubicaciones as unknown[]).length,
        lines: (root.lineas as unknown[]).length,
        inventories: (root.inventariosIniciales as unknown[]).length,
      });
    } catch {
      setError("No fue posible leer un JSON válido. El archivo permanece únicamente en memoria local.");
    }
  };

  const validate = async () => {
    if (packageData === undefined || validating) return;
    setValidating(true);
    setError(undefined);
    try {
      setReport(await repository.validateMigrationPackage(packageData));
      setImportResult(undefined);
      setHashConfirmation("");
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "No fue posible validar el paquete.");
    } finally {
      setValidating(false);
    }
  };

  const importValidatedPackage = async () => {
    if (!report || packageData === undefined || importing || !report.eligibleToImport) return;
    if (hashConfirmation.trim().toLowerCase() !== report.packageHash.slice(0, 12).toLowerCase()) {
      setError("El fragmento de confirmación no coincide con el hash validado.");
      return;
    }
    if (projectedMigrationWrites(report) > IMPORT_MAX_WRITES) {
      setError("La importación supera el límite seguro de 450 escrituras.");
      return;
    }
    setImporting(true);
    setError(undefined);
    setOperationMessage(undefined);
    try {
      const result = await repository.importMigrationPackage(
        packageData, report.packageHash, crypto.randomUUID(),
      );
      setImportResult(result);
      setOperationMessage("Importación aplicada íntegramente mediante operación central.");
      await refreshHistory();
    } catch (importFailure) {
      setError(importFailure instanceof Error ? importFailure.message : "No fue posible importar el paquete.");
    } finally {
      setImporting(false);
    }
  };

  const revertSelectedImport = async () => {
    if (!reversalTarget || reverting || reversalReason.trim().length === 0) return;
    setReverting(true);
    setHistoryError(undefined);
    setOperationMessage(undefined);
    try {
      const result = await repository.revertMigrationImport(
        reversalTarget, reversalReason.trim(), crypto.randomUUID(),
      );
      setOperationMessage(`Importación revertida: ${result.deletedDocuments} documentos creados fueron eliminados.`);
      setReversalTarget(undefined);
      setReversalReason("");
      await refreshHistory();
    } catch (reversalFailure) {
      setHistoryError(reversalFailure instanceof Error ? reversalFailure.message : "No fue posible revertir la importación.");
    } finally {
      setReverting(false);
    }
  };

  const exportReport = () => {
    if (!report) return;
    const safeExport = {
      tipo: "INFORME_VALIDACION_MIGRACION_ETAPA_18",
      confirmacion: "SOLO_VALIDACION_SIN_IMPORTACION_NI_ESCRITURAS",
      ...report,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(safeExport, null, 2)], {type: "application/json"}));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `informe-validacion-migracion-${report.packageHash.slice(0, 12)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const issues: readonly MigrationValidationIssue[] = report
    ? [...report.blockingErrors, ...report.warnings]
    : [];
  const visibleIssues = issues.filter((issue) =>
    (severityFilter === "TODAS" || issue.severity === severityFilter) &&
    (entityFilter === "TODAS" || issue.entity === entityFilter)
  );

  return (
    <section className="migration-validation" aria-labelledby="migration-validation-title">
      <header className="section-heading">
        <div>
          <p className="eyebrow">ETAPA 20 · OPERACIÓN ADMINISTRATIVA</p>
          <h1 id="migration-validation-title">Migración — Validación</h1>
        </div>
      </header>
      <div className="migration-safety-banner">
        <strong>LA VALIDACIÓN NO IMPORTA AUTOMÁTICAMENTE</strong>
        <span>Una importación exige resultado apto, hash confirmado y una transacción única mediante la Callable autorizada.</span>
      </div>
      <p className="read-only-note">
        Selecciona localmente un paquete v1. El archivo no se guarda ni se persiste automáticamente.
      </p>
      <label className="migration-file-picker">
        Archivo JSON local
        <input
          aria-label="Archivo JSON de migración"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void selectFile(event.target.files?.[0])}
        />
      </label>
      {error && <p className="alert" role="alert">{error}</p>}
      {fileName && localCounts && (
        <div className="migration-local-summary">
          <strong>Estructura local válida: {fileName}</strong>
          <span>{localCounts.locations} ubicaciones · {localCounts.lines} líneas · {localCounts.inventories} inventarios</span>
          <button className="button" type="button" disabled={validating} onClick={() => void validate()}>
            {validating ? "Validando…" : "Validar paquete"}
          </button>
        </div>
      )}

      {report && (
        <section className="migration-report" aria-labelledby="migration-report-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">INFORME SIN ESCRITURAS</p>
              <h2 id="migration-report-title">Resultado de validación</h2>
            </div>
            <button className="button button--secondary" type="button" onClick={exportReport}>
              Exportar informe seguro
            </button>
          </div>
          <div className="migration-report-summary">
            <span><strong>Hash SHA-256</strong>{report.packageHash}</span>
            <span><strong>Errores</strong>{report.blockingErrors.length}</span>
            <span><strong>Advertencias</strong>{report.warnings.length}</span>
            <span><strong>Resultado informativo</strong>{report.eligibleToImport ? "Apto para importación controlada" : "Bloqueado"}</span>
          </div>
          <p className={report.eligibleToImport ? "notice" : "alert"}>
            Validación terminada. No se realizó ninguna importación ni modificación del catálogo o inventario.
          </p>
          <div className="migration-conflicts">
            <span>Códigos existentes: {report.conflicts.existingCodes}</span>
            <span>Claves incompatibles: {report.conflicts.incompatibleKeys}</span>
            <span>Líneas con inventario: {report.conflicts.linesWithCurrentInventory}</span>
            <span>Conflictos operativos: {report.conflicts.operationalConflicts}</span>
          </div>
          <div className="monitor-filters">
            <label>Severidad<select aria-label="Filtrar severidad" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}><option value="TODAS">Todas</option><option value="ERROR">Errores</option><option value="ADVERTENCIA">Advertencias</option></select></label>
            <label>Entidad<select aria-label="Filtrar entidad" value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)}><option value="TODAS">Todas</option><option value="PAQUETE">Paquete</option><option value="UBICACION">Ubicaciones</option><option value="LINEA">Líneas</option><option value="INVENTARIO_INICIAL">Inventarios</option></select></label>
          </div>
          <div className="migration-issues">
            {visibleIssues.length === 0 ? <p>Sin hallazgos para los filtros seleccionados.</p> : visibleIssues.map((issue, index) => (
              <article className={`migration-issue migration-issue--${issue.severity.toLowerCase()}`} key={`${issue.code}-${issue.externalKey ?? "package"}-${index}`}>
                <strong>{issue.severity} · {entityLabel(issue.entity)} · {issue.code}</strong>
                {issue.externalKey && <span>{issue.externalKey}</span>}
                <p>{issue.message}</p>
              </article>
            ))}
          </div>
          {report.eligibleToImport && (
            <section className="migration-import-confirmation" aria-labelledby="migration-import-title">
              <p className="eyebrow">IMPORTACIÓN CONTROLADA · CONFIRMACIÓN REQUERIDA</p>
              <h3 id="migration-import-title">Importar paquete validado</h3>
              <p>
                Se proyectan <strong>{projectedMigrationWrites(report)} escrituras</strong> en una sola transacción.
                No se permite dividir el paquete ni mezclarlo con registros existentes.
              </p>
              <label>
                Escribe los primeros 12 caracteres del hash
                <input
                  aria-label="Confirmar fragmento del hash"
                  value={hashConfirmation}
                  maxLength={12}
                  onChange={(event) => setHashConfirmation(event.target.value)}
                />
              </label>
              <button
                className="button"
                type="button"
                disabled={importing || projectedMigrationWrites(report) > IMPORT_MAX_WRITES ||
                  hashConfirmation.trim().toLowerCase() !== report.packageHash.slice(0, 12).toLowerCase()}
                onClick={() => void importValidatedPackage()}
              >
                {importing ? "Importando atómicamente…" : "Importar paquete"}
              </button>
            </section>
          )}
          {importResult && (
            <section className="migration-import-result" aria-label="Resultado de importación">
              <h3>Importación APLICADA</h3>
              <span>ID: {importResult.importId}</span>
              <span>Hash: {importResult.packageHash}</span>
              <span>{importResult.writes} escrituras confirmadas</span>
              <details>
                <summary>Mapa de IDs generado por el backend</summary>
                {[...importResult.map.locations, ...importResult.map.lines].map((entry) => (
                  <code key={entry.externalKey}>{entry.externalKey} → {entry.internalId}</code>
                ))}
              </details>
            </section>
          )}
        </section>
      )}
      {operationMessage && <p className="notice" role="status">{operationMessage}</p>}
      <section className="migration-history" aria-labelledby="migration-history-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TRAZABILIDAD CONSERVADA</p>
            <h2 id="migration-history-title">Historial de importaciones</h2>
          </div>
          <button className="button button--secondary" type="button" onClick={() => void refreshHistory()}>
            Actualizar historial
          </button>
        </div>
        {historyError && <p className="alert" role="alert">{historyError}</p>}
        {history.length === 0 ? <p>Sin importaciones registradas.</p> : history.map((entry) => (
          <article className="migration-history-item" key={entry.importId}>
            <div>
              <strong>{entry.status} · {entry.importId}</strong>
              <span>{entry.counts.locations} ubicaciones · {entry.counts.lines} líneas · {entry.counts.initialInventories} inventarios</span>
              <span>Hash: {entry.packageHash}</span>
              <span>Aplicada por {entry.appliedByDisplayName} · {entry.appliedAt}</span>
              {entry.reversalBlockers.length > 0 && entry.status === "APLICADA" && (
                <span>No reversible: {entry.reversalBlockers.join(", ")}</span>
              )}
              {entry.reversalReason && <span>Motivo de reversión: {entry.reversalReason}</span>}
            </div>
            {entry.reversalEligible && (
              <button className="button button--danger" type="button" onClick={() => {
                setReversalTarget(entry);
                setReversalReason("");
              }}>
                Revertir importación
              </button>
            )}
          </article>
        ))}
        {reversalTarget && (
          <div className="migration-reversal-confirmation" role="dialog" aria-label="Confirmar reversión">
            <strong>Revertir {reversalTarget.importId}</strong>
            <p>Solo continuará si todos los recursos permanecen exactamente sin uso ni modificaciones.</p>
            <label>Motivo obligatorio<textarea aria-label="Motivo de reversión" maxLength={2000} value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} /></label>
            <div className="dialog-actions">
              <button className="button button--secondary" type="button" onClick={() => setReversalTarget(undefined)}>Cancelar</button>
              <button className="button button--danger" type="button" disabled={reverting || reversalReason.trim().length === 0} onClick={() => void revertSelectedImport()}>
                {reverting ? "Verificando y revirtiendo…" : "Confirmar reversión"}
              </button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
