import {fireEvent, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {DisabledMonitorRepository} from "./shared/data/FirebaseMonitorRepository";
import type {MonitorRepository, MonitorUser} from "./shared/domain/MonitorModels";
import {InventoryReportsSection} from "./shared/presentation/InventoryReportsSection";
import {WebApp} from "./WebApp";
import {webPlatform} from "./webPlatform";

const admin: MonitorUser = {id: "admin-prueba", displayName: "Admin Prueba", role: "ADMINISTRADOR",
  canReview: true, canRelease: true, canViewReservationDetails: true,
  canManageUsers: true, canManageCatalog: true, canManageDraftJourneys: true};

function repository(user = admin): MonitorRepository {
  return Object.assign(new DisabledMonitorRepository(), {
    environment: "EMULATOR" as const, emulatorEnabled: true,
    signIn: vi.fn().mockResolvedValue(user),
    listActiveJourneys: vi.fn().mockResolvedValue([]),
    listInventoryReports: vi.fn().mockResolvedValue({informes: []}),
    getGoogleDriveConnectionStatus: vi.fn().mockResolvedValue({state: "LISTO"}),
    revokeGoogleDriveOAuth: vi.fn().mockResolvedValue({state: "REVOCADO"}),
    listManageableUsers: vi.fn().mockResolvedValue([]),
    listManageableCatalog: vi.fn().mockResolvedValue({locations: [], lines: []}),
    listManageableLots: vi.fn().mockResolvedValue([]),
    listManageableCountStatistics: vi.fn().mockResolvedValue({currentCount: 0, historicalCount: 0, females: 0, males: 0, rootstocks: 0, total: 0, byState: [], byAuthor: [], byLot: []}),
  });
}

afterEach(() => vi.restoreAllMocks());

describe("Vivero Maestro Web", () => {
  it("restaura la sesión al volver a montar la página sin pedir contraseña", async () => {
    const repo = Object.assign(repository(), {restoreSession: vi.fn().mockResolvedValue(admin)});
    const first = render(<WebApp repository={repo} />);
    expect(await screen.findByRole("button", {name: "Administración"})).toBeDisabled();
    first.unmount();
    render(<WebApp repository={repo} />);
    expect(await screen.findByRole("button", {name: "Administración"})).toBeDisabled();
    expect(repo.signIn).not.toHaveBeenCalled();
    expect(repo.restoreSession).toHaveBeenCalledTimes(2);
  });

  it("no concede acceso si restaurar la sesión falla", async () => {
    const repo = Object.assign(repository(), {restoreSession: vi.fn().mockRejectedValue(new Error("Cuenta desactivada"))});
    render(<WebApp repository={repo} />);
    expect(await screen.findByRole("button", {name: "Iniciar sesión"})).toBeEnabled();
    expect(screen.queryByRole("button", {name: "Administración"})).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Cuenta desactivada");
  });
  it("muestra acceso sin Electron y falla cerrado sin configuración", () => {
    render(<WebApp repository={new DisabledMonitorRepository()} configurationError="Falta VITE_APP_ENV" />);
    expect(screen.queryByText(/VERSIÓN WEB/)).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Falta VITE_APP_ENV");
    expect(screen.getByRole("button", {name: "Iniciar sesión"})).toBeDisabled();
  });
  it("permite solo el menú principal durante la reestructuración", async () => {
    const repo = repository();
    render(<WebApp repository={repo} />);
    fireEvent.change(screen.getByLabelText("Correo"), {target: {value: "admin@prueba.local"}});
    fireEvent.change(screen.getByLabelText("Contraseña"), {target: {value: "Ficticia123"}});
    fireEvent.click(screen.getByRole("button", {name: "Iniciar sesión"}));
    expect(await screen.findByRole("button", {name: "Administración"})).toBeDisabled();
    expect(screen.getByRole("button", {name: "Menú principal"})).toBeEnabled();
    expect(screen.getByRole("button", {name: "Inventario"})).toBeDisabled();
    expect(screen.getByRole("button", {name: "Conteos"})).toBeDisabled();
    expect(screen.queryByRole("button", {name: "Jornadas"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button", {name: "Labores"})).not.toBeInTheDocument();
    expect(screen.getByRole("button", {name: "Mapa"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button", {name: "Administración"}));
    expect(screen.queryByRole("button", {name: "Crear usuario"})).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", {name: /Propagación de\s*material vegetal/})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: "Colapsar menú"}));
    expect(screen.getByRole("button", {name: "Expandir menú"})).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByAltText("Arles")).toBeInTheDocument();
  });
  it("no expone administración a auxiliares", async () => {
    const user = {...admin, role: "AUXILIAR" as const, canReview: false, canManageUsers: false,
      canManageCatalog: false, canManageDraftJourneys: false};
    render(<WebApp repository={repository(user)} />);
    fireEvent.change(screen.getByLabelText("Correo"), {target: {value: "auxiliar@prueba.local"}});
    fireEvent.change(screen.getByLabelText("Contraseña"), {target: {value: "Ficticia123"}});
    fireEvent.click(screen.getByRole("button", {name: "Iniciar sesión"}));
    await screen.findByRole("button", {name: "Cerrar sesión"});
    expect(screen.queryByRole("button", {name: "Usuarios"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button", {name: "Administración"})).not.toBeInTheDocument();
  });
  it("oculta OAuth desktop pero conserva estado y revocación confirmada", async () => {
    const repo = repository();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<InventoryReportsSection repository={repo} currentUser={admin} platform={webPlatform} />);
    await screen.findByText("Listo para generar informes");
    expect(screen.getByText(/OAuth web está pendiente/)).toBeInTheDocument();
    expect(screen.queryByRole("button", {name: /Conectar|Seleccionar|Reconectar/})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: "Revocar autorizacion"}));
    await screen.findByText("Autorizacion revocada");
    expect(repo.revokeGoogleDriveOAuth).toHaveBeenCalledOnce();
  });
  it("no consulta ni presenta configuración Drive a auxiliares", async () => {
    const repo = repository();
    render(<InventoryReportsSection repository={repo} currentUser={{...admin, role: "AUXILIAR"}} platform={webPlatform} />);
    await screen.findByText(/No hay informes/);
    expect(repo.getGoogleDriveConnectionStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", {name: "Revocar autorizacion"})).not.toBeInTheDocument();
  });
});
