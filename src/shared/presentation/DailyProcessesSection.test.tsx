import {render, screen} from "@testing-library/react";
import {expect, it, vi} from "vitest";
import {DisabledMonitorRepository} from "../data/FirebaseMonitorRepository";
import type {MonitorRepository} from "../domain/MonitorModels";
import {DailyProcessesSection} from "./DailyProcessesSection";

it("informa que no existe conexión y no inventa actividades", () => {
  render(<DailyProcessesSection />);
  expect(screen.getByText("Conexión pendiente")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("conexión");
  expect(screen.queryByText("Finalizado")).not.toBeInTheDocument();
});

it("distingue una fuente conectada sin registros", () => {
  render(<DailyProcessesSection activities={[]} />);
  expect(screen.getByRole("status")).toHaveTextContent("No hay actividades registradas");
});

it("consulta solo el emulador y muestra errores sin inventar un vacío", async () => {
  const repository = Object.assign(new DisabledMonitorRepository(), {environment: "EMULATOR" as const, listDailyActivities: vi.fn().mockRejectedValue(new Error("offline"))}) as unknown as MonitorRepository;
  render(<DailyProcessesSection repository={repository} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible consultar");
  expect(screen.queryByText("No hay actividades registradas para esta fecha.")).not.toBeInTheDocument();
});

it("no llama al nuevo servicio en producción", () => {
  const repository = Object.assign(new DisabledMonitorRepository(), {environment: "PRODUCTION" as const, listDailyActivities: vi.fn()}) as unknown as MonitorRepository;
  render(<DailyProcessesSection repository={repository} />);
  expect(repository.listDailyActivities).not.toHaveBeenCalled();
});
