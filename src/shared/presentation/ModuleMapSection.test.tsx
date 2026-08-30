import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";
import {DisabledMonitorRepository} from "../data/FirebaseMonitorRepository";
import type {MonitorLine, MonitorRepository, MonitorSnapshot} from "../domain/MonitorModels";
import {ModuleMapSection} from "./ModuleMapSection";

function line(overrides: Partial<MonitorLine> & Pick<MonitorLine, "id" | "state">): MonitorLine {
  return {
    lineId: `catalogo-${overrides.id}`,
    version: 2,
    location: {
      nursery: "Vivero Cacay",
      module: "Módulo 1",
      bed: "Cama 1",
      line: overrides.id === "linea-38" ? "Línea 38" : "Línea 37",
      displayName: overrides.id === "linea-38" ? "Módulo 1 · Cama 1 · Línea 38" : "Módulo 1 · Cama 1 · Línea 37",
      order: overrides.id === "linea-38" ? 38 : 37,
    },
    ...overrides,
  };
}

const snapshot: MonitorSnapshot = {
  journeyId: "jornada-1",
  journeyDisplayName: "Jornada agosto",
  correctionCandidates: [],
  lines: [
    line({
      id: "linea-38",
      state: "APROBADA",
      count: {
        id: "conteo-1", authorUserId: "aux-1", authorDisplayName: "Auxiliar",
        effectiveRole: "AUXILIAR", deviceId: "telefono-1", females: 120, males: 30,
        rootstocks: 10, deadPlants: 4, total: 160, deviceTimestamp: "2026-08-29T10:00:00Z",
        serverTimestamp: "2026-08-29T10:00:01Z", version: 1,
      },
    }),
    line({id: "linea-37", state: "DISPONIBLE"}),
  ],
};

function repository(): MonitorRepository {
  return Object.assign(new DisabledMonitorRepository(), {
    listManageableCatalog: async () => ({
      locations: [
        {id: "vivero", code: "V", type: "VIVERO", displayName: "Vivero Cacay", order: 1, active: true, version: 1, activeChildCount: 1, activeLineCount: 2},
        {id: "modulo", code: "M1", type: "MODULO", parentId: "vivero", displayName: "Módulo 1", order: 1, active: true, version: 1, activeChildCount: 1, activeLineCount: 2},
        {id: "cama", code: "C1", type: "CAMA", parentId: "modulo", displayName: "Cama 1", order: 1, active: true, version: 1, activeChildCount: 0, activeLineCount: 2},
      ],
      lines: [
        {id: "catalogo-linea-38", locationId: "cama", code: "Línea 38", displayName: "Módulo 1 · Cama 1 · Línea 38", order: 38, active: true, version: 1, occupiedByActiveJourney: false, draftSelectionCount: 0, inventory: {females: 120, males: 30, rootstocks: 10, total: 160, version: 1, origin: "CONTEO", actorUserId: "admin", actorDisplayName: "Admin", updatedAt: "2026-08-29T10:00:00Z"}},
        {id: "catalogo-linea-37", locationId: "cama", code: "Línea 37", displayName: "Módulo 1 · Cama 1 · Línea 37", order: 37, active: true, version: 1, occupiedByActiveJourney: false, draftSelectionCount: 0},
      ],
    }),
    listManageableLots: async () => [{id: "lote-1", displayName: "Lote julio", sowingDate: "2026-07-15", state: "ACTIVO" as const, version: 1, lineIds: ["catalogo-linea-38"], inventory: {females: 120, males: 30, rootstocks: 10, total: 160, linesWithInventory: 1, linesWithoutInventory: 0}, createdByUserId: "admin", createdAt: "2026-07-15T00:00:00Z", updatedAt: "2026-07-15T00:00:00Z"}],
  });
}

describe("ModuleMapSection", () => {
  it("representa estados del módulo y abre el detalle real de una línea", async () => {
    render(<ModuleMapSection repository={repository()} snapshot={snapshot} loading={false} />);
    expect(await screen.findByText("1 realizadas")).toBeInTheDocument();
    expect(screen.getByText("1 pendientes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: "Módulo 1 · Cama 1 · Línea 38: Realizada"}));
    expect(screen.getByText("Lote julio")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("160")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("no inventa cantidades ni labores para una línea pendiente", async () => {
    render(<ModuleMapSection repository={repository()} snapshot={snapshot} loading={false} />);
    await screen.findByText("1 pendientes");
    fireEvent.click(screen.getByRole("button", {name: "Módulo 1 · Cama 1 · Línea 37: Pendiente"}));
    expect(screen.getAllByText("Sin dato")).toHaveLength(5);
    expect(screen.getByText("No registrado")).toBeInTheDocument();
    expect(screen.getByText("Sin información")).toBeInTheDocument();
  });
});
