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
it("conserva las mediciones antiguas sin inventar cinco calificaciones pendientes",()=>{
  render(<GraftingSection records={[{...records[0]!,samples:[{...records[0]!.samples[0]!,sourcePage:3,sourceLayout:"ROOTSTOCK_MEASUREMENTS",stemThicknessMm:6.8,graftCriteria:undefined}],source:{file:"original.pdf",sha256:"a".repeat(64),version:"001",pages:[3],layout:"ROOTSTOCK_MEASUREMENTS"}}]}/>);
  expect(screen.queryByText("Sin evaluar")).not.toBeInTheDocument();
  expect(screen.getByText("Muestra 1 · Pág. 3")).toBeInTheDocument();
  expect(screen.getByText(/Grosor registrado: 6,8 mm/)).toBeInTheDocument();
  expect(screen.getByText("Cumple",{selector:".grafting-result"})).toBeInTheDocument();
  expect(screen.queryByRole("heading",{name:/^Injerto$/})).not.toBeInTheDocument();
});
it("las recolecciones antiguas no generan criterios ficticios y el total incompleto se identifica como subtotal",()=>{
  const historical={...records[1]!,yemaCollections:records[1]!.yemaCollections.map((b,i)=>({...b,sourceLayout:"BUD_COLLECTIONS" as const,yemaQuantity:i?null:16})),source:{file:"original.pdf",sha256:"a".repeat(64),version:"001",pages:[1],layout:"BUD_COLLECTIONS" as const}};
  render(<GraftingSection records={[historical]}/>);
  fireEvent.click(screen.getByRole("button",{name:"Yemas"}));
  expect(screen.getByText("Yemas con cantidad legible (subtotal)")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("1 recolecciones sin cantidad legible");
  expect(screen.queryByText("Sin evaluar")).not.toBeInTheDocument();
  expect(screen.getByText(/no contiene criterios de calificación/)).toBeInTheDocument();
});
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
