import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import {DisabledMonitorRepository} from "../data/FirebaseMonitorRepository";
import type {MonitorRepository} from "../domain/MonitorModels";
import {DashboardSection} from "./DashboardSection";

function repository(): MonitorRepository {
  return Object.assign(new DisabledMonitorRepository(), {
    listManageableCatalog: vi.fn().mockResolvedValue({
      locations: [
        {id: "modulo-1", code: "M1", type: "MODULO", displayName: "Módulo 1", order: 1, active: true, version: 1, activeChildCount: 1, activeLineCount: 2},
        {id: "cama-1", code: "C1", type: "CAMA", parentId: "modulo-1", displayName: "Cama 1", order: 1, active: true, version: 1, activeChildCount: 0, activeLineCount: 2},
      ],
      lines: [
        {id: "linea-1", locationId: "cama-1", code: "L1", displayName: "Línea 1", order: 1, active: true, version: 1, occupiedByActiveJourney: false, draftSelectionCount: 0,
          inventory: {females: 100, males: 20, rootstocks: 10, total: 130, version: 1, origin: "PRUEBA", actorUserId: "admin", actorDisplayName: "Admin", updatedAt: "2026-08-30T10:00:00Z"}},
        {id: "linea-2", locationId: "cama-1", code: "L2", displayName: "Línea 2", order: 2, active: true, version: 1, occupiedByActiveJourney: false, draftSelectionCount: 0},
      ],
    }),
    listManageableLots: vi.fn().mockResolvedValue([]),
  });
}

describe("DashboardSection", () => {
  it("consolida el inventario oficial sin inventar lotes", async () => {
    render(<DashboardSection repository={repository()} />);
    expect(await screen.findAllByText("130")).toHaveLength(2);
    expect(screen.getAllByText("100")).toHaveLength(2);
    expect(screen.getAllByText("20")).toHaveLength(2);
    expect(screen.getAllByText("10")).toHaveLength(2);
    expect(screen.getByText("1 de 2 líneas con inventario")).toBeInTheDocument();
    expect(screen.getByText("Sin lotes registrados")).toBeInTheDocument();
  });
});
