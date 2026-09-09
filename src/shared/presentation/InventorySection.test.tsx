import {fireEvent, render, screen} from "@testing-library/react";
import {expect, it, vi} from "vitest";
import {DisabledMonitorRepository} from "../data/FirebaseMonitorRepository";
import {InventorySection} from "./InventorySection";

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
