import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import {DisabledMonitorRepository} from "../data/FirebaseMonitorRepository";
import {CountStatisticsSection} from "./CountStatisticsSection";

describe("CountStatisticsSection", () => {
  it("muestra totales vigentes por lote y responsable", async () => {
    const repository = Object.assign(new DisabledMonitorRepository(), {listManageableCountStatistics: vi.fn().mockResolvedValue({currentCount: 2, historicalCount: 3, females: 100, males: 20, rootstocks: 10, total: 130, byState: [{key: "APROBADA", displayName: "APROBADA", count: 2, females: 100, males: 20, rootstocks: 10, total: 130}], byAuthor: [{key: "aux", displayName: "Auxiliar 1", count: 2, females: 100, males: 20, rootstocks: 10, total: 130}], byLot: [{key: "lote", displayName: "Lote julio", count: 2, females: 100, males: 20, rootstocks: 10, total: 130}]})});
    render(<CountStatisticsSection repository={repository} />);
    expect(await screen.findByText("Lote julio")).toBeInTheDocument();
    expect(screen.getByText("Auxiliar 1")).toBeInTheDocument();
    expect(screen.getAllByText("130").length).toBeGreaterThan(1);
  });
});
