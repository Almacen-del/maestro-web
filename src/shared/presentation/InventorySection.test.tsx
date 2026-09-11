import {fireEvent, render, screen} from "@testing-library/react";
import {expect, it, vi} from "vitest";
import {DisabledMonitorRepository} from "../data/FirebaseMonitorRepository";
import {InventorySection} from "./InventorySection";

it("muestra el responsable guardado por línea sin inventar responsables ni confundir cero con sin contar", async () => {
  const repository = Object.assign(new DisabledMonitorRepository(), {
    listManageableCatalog: vi.fn().mockResolvedValue({locations: [], lines: [
      {id: "a", active: true, code: "L1", displayName: "Línea registrada", inventory: {
        total: 0, females: 0, males: 0, rootstocks: 0, actorDisplayName: "Responsable móvil",
      }},
      {id: "b", active: true, code: "L2", displayName: "Línea pendiente"},
    ]}),
  });
  render(<InventorySection repository={repository} />);
  expect(await screen.findByText("Responsable móvil")).toBeInTheDocument();
  expect(screen.getByText("Registrada")).toBeInTheDocument();
  expect(screen.getByText("Sin contar")).toBeInTheDocument();
  expect(screen.getByText("No disponible", {selector: "td"})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name: "Ver detalle de Línea registrada"}));
  expect(screen.getByText("Responsable móvil", {selector: "dd"})).toBeInTheDocument();
});

it("filtra camas, recalcula el total y reinicia la cama al cambiar módulo", async () => {
  const repository = Object.assign(new DisabledMonitorRepository(), {
    listManageableCatalog: vi.fn().mockResolvedValue({locations: [
      {id: "m1", type: "MODULO", displayName: "Módulo 1"},
      {id: "c1", type: "CAMA", parentId: "m1", displayName: "Cama 1", order: 1},
      {id: "c2", type: "CAMA", parentId: "m1", displayName: "Cama 2", order: 2},
      {id: "m2", type: "MODULO", displayName: "Módulo 2"},
    ], lines: [
      {id: "a", locationId: "c1", active: true, code: "L1", displayName: "Primera cama", inventory: {total: 10, females: 10, males: 0, rootstocks: 0}},
      {id: "b", locationId: "c2", active: true, code: "L1", displayName: "Segunda cama", inventory: {total: 20, females: 20, males: 0, rootstocks: 0}},
      {id: "c", locationId: "m2", active: true, code: "L1", displayName: "Otro módulo", inventory: {total: 5, females: 5, males: 0, rootstocks: 0}},
    ]}),
  });
  render(<InventorySection repository={repository} />);
  await screen.findByText("35 plantas visibles");
  fireEvent.change(screen.getByLabelText("Filtrar por módulo"), {target: {value: "m1"}});
  expect(screen.getByText("30 plantas visibles")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name: "Cama 2"}));
  expect(screen.getByText("20 plantas visibles")).toBeInTheDocument();
  expect(screen.queryByText("Primera cama")).not.toBeInTheDocument();
  expect(screen.getByRole("button", {name: "Cama 2"})).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", {name: "Todas las camas"}));
  expect(screen.getByText("30 plantas visibles")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name: "Cama 1"}));
  fireEvent.change(screen.getByLabelText("Filtrar por módulo"), {target: {value: "m2"}});
  expect(screen.getByText("5 plantas visibles")).toBeInTheDocument();
  expect(screen.queryByRole("group", {name: "Filtrar por cama"})).not.toBeInTheDocument();
});

it("consulta y filtra módulos y germinadores sin depender de lotes", async () => {
  const repository = Object.assign(new DisabledMonitorRepository(), {
    listManageableCatalog: vi.fn().mockResolvedValue({locations: [
      {id: "m1", type: "MODULO", displayName: "Módulo 1"},
      {id: "c1", type: "CAMA", parentId: "m1", displayName: "Cama 1"},
      {id: "g3", type: "GERMINADOR", displayName: "Germinador 3"},
    ], lines: [
      {id: "a", locationId: "c1", active: true, code: "L1", displayName: "Línea del módulo"},
      {id: "b", locationId: "g3", active: true, code: "L2", displayName: "Línea del germinador"},
    ]}),
    listManageableLots: vi.fn(),
  });
  render(<InventorySection repository={repository} />);
  expect(await screen.findByText("Línea del módulo")).toBeInTheDocument();
  expect(screen.getByRole("columnheader", {name: "Módulo"})).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filtrar por módulo"), {target: {value: "g3"}});
  expect(screen.queryByText("Línea del módulo")).not.toBeInTheDocument();
  expect(screen.getByText("Línea del germinador")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filtrar por módulo"), {target: {value: "ALL"}});
  fireEvent.change(screen.getByLabelText("Buscar inventario"), {target: {value: "Módulo 1"}});
  expect(screen.getByText("Línea del módulo")).toBeInTheDocument();
  expect(screen.queryByText("Línea del germinador")).not.toBeInTheDocument();
  expect(repository.listManageableLots).not.toHaveBeenCalled();
});
