import {fireEvent, render, screen, within} from "@testing-library/react";
import {expect, it} from "vitest";
import {GraftingSection, type GraftingRecord} from "./GraftingSection";

const records: readonly GraftingRecord[] = [
  {id: "injerto", date: "2026-09-02", responsible: "Responsable A", formType: "PV_F008_INJERTACION", totalGraftsCount: 750, samples: [{id: "m1", sampleNumber: 1, module: "2", bed: "1", line: "3", treeAge: "9 meses", healthyCondition: "C", graftCriteria: [{status: "NC", treatment: "2", notes: "Revisar acople"}]}], yemaCollections: []},
  {id: "yemas", date: "2026-09-03", responsible: "Responsable B", formType: "PV_F007_YEMAS", samples: [], yemaCollections: [
    {id: "y1", collectionDate: "2026-09-03", lot: "15", line: "34", gender: "H", motherTree: "10", yemaQuantity: 16, criteria: [{status: "N.A"}]},
    {id: "y2", collectionDate: "2026-09-03", lot: "15", line: "35", gender: "M", motherTree: "10", yemaQuantity: 0},
  ]},
];
it("separa ambos formatos y no inventa criterios ni registros", () => {
  render(<GraftingSection />);
  expect(screen.getByText("Conexión pendiente")).toBeInTheDocument();
  expect(screen.getAllByText("Sin evaluar")).toHaveLength(6);
  fireEvent.click(screen.getByRole("button", {name: "Yemas"}));
  expect(screen.getAllByText("Sin evaluar")).toHaveLength(3);
});
it("no deduce el muestreo faltante ni califica el injerto a partir del patrón", () => {
  render(<GraftingSection records={records} />);
  const summary = screen.getByLabelText("Totales del registro completo");
  expect(within(summary).getByText("750")).toBeInTheDocument();
  expect(within(summary).getByText("—")).toBeInTheDocument();
  expect(screen.getByText("Cumple", {selector: ".grafting-result"})).toBeInTheDocument();
  expect(screen.getByText("No cumple", {selector: ".grafting-result"})).toBeInTheDocument();
  expect(screen.getAllByText("Sin evaluar")).toHaveLength(4);
  expect(screen.getByText("Revisar acople")).toBeInTheDocument();
});
it("conserva cero, distingue árboles por procedencia y filtra sin alterar totales del registro", () => {
  render(<GraftingSection records={records} />);
  fireEvent.click(screen.getByRole("button", {name: "Yemas"}));
  const summary = screen.getByLabelText("Totales del registro completo");
  expect(within(summary).getByText("16")).toBeInTheDocument();
  expect(within(summary).getAllByText("2")).toHaveLength(2);
  expect(screen.getByText("0 yemas")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Buscar en el detalle"), {target: {value: "35"}});
  expect(screen.queryByText("16 yemas")).not.toBeInTheDocument();
  expect(within(summary).getByText("16")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Mes del registro"), {target: {value: "2026-08"}});
  expect(screen.getByRole("status")).toHaveTextContent("No hay registros");
});
