import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import {DisabledMonitorRepository} from "../data/FirebaseMonitorRepository";
import type {MonitorRepository} from "../domain/MonitorModels";
import {LotsSection} from "./LotsSection";

const lot = {
  id: "lote-1", displayName: "Lote julio", sowingDate: "2026-07-15", state: "ACTIVO" as const,
  version: 1, lineIds: [] as string[], inventory: {females: 0, males: 0, rootstocks: 0, total: 0, linesWithInventory: 0, linesWithoutInventory: 0},
  createdByUserId: "admin", createdAt: "2026-07-15T00:00:00Z", updatedAt: "2026-07-15T00:00:00Z",
};

function repository(): MonitorRepository {
  return Object.assign(new DisabledMonitorRepository(), {
    listManageableLots: vi.fn().mockResolvedValue([lot]),
    listManageableCatalog: vi.fn().mockResolvedValue({locations: [], lines: [
      {id: "linea-1", locationId: "cama-1", code: "L1", displayName: "Línea 1", order: 1, active: true, version: 1, occupiedByActiveJourney: false, draftSelectionCount: 0},
    ]}),
    updateProductionLotLines: vi.fn().mockResolvedValue({...lot, version: 2, lineIds: ["linea-1"]}),
  });
}

describe("LotsSection", () => {
  it("usa botones por fecha y muestra Sin injertación sin desplegable", async () => {
    render(<LotsSection repository={repository()} />);
    await screen.findByRole("checkbox");
    expect(screen.getByLabelText("Mes y año de siembra")).toHaveAttribute("type", "month");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: "Por injertación"}));
    expect(screen.getByRole("button", {name: "Por injertación"})).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Mes y año de injertación")).toHaveAttribute("type", "month");
    fireEvent.click(screen.getByRole("button", {name: /Sin injertación/}));
    expect(screen.getByRole("heading", {name: "Sin injertación"})).toBeInTheDocument();
    expect(screen.getByText(/Línea 1 · Sin inventario/)).toBeInTheDocument();
  });

  it("asigna una línea al lote seleccionado", async () => {
    const repo = repository();
    render(<LotsSection repository={repo} />);
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", {name: "Guardar líneas"}));
    expect(repo.updateProductionLotLines).toHaveBeenCalledWith("lote-1", 1, ["linea-1"], expect.any(String));
    expect(await screen.findByText("Asignación de líneas guardada.")).toBeInTheDocument();
  });
});
