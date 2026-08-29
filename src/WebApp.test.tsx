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
    restoreSession: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn().mockResolvedValue(user),
    listActiveJourneys: vi.fn().mockResolvedValue([]),
    listInventoryReports: vi.fn().mockResolvedValue({informes: []}),
    getGoogleDriveConnectionStatus: vi.fn().mockResolvedValue({state: "LISTO"}),
    revokeGoogleDriveOAuth: vi.fn().mockResolvedValue({state: "REVOCADO"}),
    listManageableUsers: vi.fn().mockResolvedValue([]),
  });
}

afterEach(() => vi.restoreAllMocks());

describe("Vivero Maestro Web", () => {
  it("muestra acceso sin Electron y falla cerrado sin configuración", async () => {
    render(<WebApp repository={new DisabledMonitorRepository()} configurationError="Falta VITE_APP_ENV" />);
    expect(screen.getByText(/VERSIÓN WEB/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Falta VITE_APP_ENV");
    expect(await screen.findByRole("button", {name: "Iniciar sesión"})).toBeDisabled();
  });
  it("permite acceso y navegación administrativa mediante el repositorio existente", async () => {
    const repo = repository();
    render(<WebApp repository={repo} />);
    fireEvent.change(screen.getByLabelText("Correo"), {target: {value: "admin@prueba.local"}});
    fireEvent.change(screen.getByLabelText("Contraseña"), {target: {value: "Ficticia123"}});
    fireEvent.click(await screen.findByRole("button", {name: "Iniciar sesión"}));
    expect(await screen.findByRole("button", {name: "Catálogo"})).toBeEnabled();
    expect(screen.getByRole("button", {name: "Jornadas"})).toBeEnabled();
    fireEvent.click(screen.getByRole("button", {name: "Usuarios"}));
    expect(await screen.findByRole("button", {name: "Crear usuario"})).toBeEnabled();
  });
  it("restaura una sesión web sin solicitar de nuevo la contraseña", async () => {
    const repo = repository();
    vi.mocked(repo.restoreSession).mockResolvedValue(admin);
    render(<WebApp repository={repo} />);
    expect(await screen.findByRole("button", {name: "Cerrar sesión"})).toBeEnabled();
    expect(screen.getByText(/Admin Prueba · ADMINISTRADOR/)).toBeInTheDocument();
    expect(repo.signIn).not.toHaveBeenCalled();
  });
  it("no expone administración a auxiliares", async () => {
    const user = {...admin, role: "AUXILIAR" as const, canReview: false, canManageUsers: false,
      canManageCatalog: false, canManageDraftJourneys: false};
    render(<WebApp repository={repository(user)} />);
    fireEvent.change(screen.getByLabelText("Correo"), {target: {value: "auxiliar@prueba.local"}});
    fireEvent.change(screen.getByLabelText("Contraseña"), {target: {value: "Ficticia123"}});
    fireEvent.click(await screen.findByRole("button", {name: "Iniciar sesión"}));
    await screen.findByRole("button", {name: "Cerrar sesión"});
    expect(screen.queryByRole("button", {name: "Usuarios"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button", {name: "Catálogo"})).not.toBeInTheDocument();
  });
  it("ofrece OAuth web y conserva revocación confirmada", async () => {
    const repo = repository();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<InventoryReportsSection repository={repo} currentUser={admin} platform={webPlatform} />);
    await screen.findByText("Listo para generar informes");
    expect(screen.getByText(/Google Picker/)).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "Seleccionar plantilla"})).toBeEnabled();
    expect(screen.getByRole("button", {name: "Seleccionar carpeta de salida"})).toBeEnabled();
    expect(screen.getByRole("button", {name: "Reconectar"})).toBeEnabled();
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
