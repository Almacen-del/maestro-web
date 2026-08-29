import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";
import type {MonitorLine, MonitorSnapshot} from "../domain/MonitorModels";
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

describe("ModuleMapSection", () => {
  it("representa estados del módulo y abre el detalle real de una línea", () => {
    render(<ModuleMapSection snapshot={snapshot} loading={false} />);
    expect(screen.getByText("1 realizadas")).toBeInTheDocument();
    expect(screen.getByText("1 pendientes o devueltas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: "Módulo 1 · Cama 1 · Línea 38: Realizada"}));
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("160")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("no inventa cantidades cuando una línea todavía no tiene conteo", () => {
    render(<ModuleMapSection snapshot={snapshot} loading={false} />);
    fireEvent.click(screen.getByRole("button", {name: "Módulo 1 · Cama 1 · Línea 37: Pendiente"}));
    expect(screen.getAllByText("Sin dato")).toHaveLength(4);
    expect(screen.getByText("No registrado")).toBeInTheDocument();
  });
});
