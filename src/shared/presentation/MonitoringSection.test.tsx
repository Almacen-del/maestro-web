import {fireEvent, render, screen, within} from "@testing-library/react";
import {expect, it} from "vitest";
import {MonitoringSection, monitoringTemplate, type MonitoringRecord} from "./MonitoringSection";

const records: readonly MonitoringRecord[] = [
  {id: "a", date: "2026-08-01", responsible: "Responsable A", groups: [
    {id: "watering", fields: [{label: "Cantidad de agua por planta", value: "200 ml"}], observations: "Observación del bloque", criteria: [{index: 0, status: "FAIL", treatments: ["CORRECTION"], observations: "Falta riego"}, {index: 1, status: "NOT_APPLICABLE"}]},
    {id: "weeding", criteria: [{index: 0, status: "PASS"}]},
  ]},
  {id: "b", date: "2026-09-01", responsible: "Responsable B", director: "Director de prueba", groups: [
    {id: "transplant", fields: [{label: "Cantidad de agua por planta", value: "100 ml"}], criteria: []},
  ]},
];

it("presenta seis bloques y 19 criterios sin inventar evaluaciones ni importar historia", () => {
  render(<MonitoringSection />);
  expect(monitoringTemplate.flatMap((group) => group.criteria)).toHaveLength(19);
  expect(screen.getAllByText("Sin evaluar", {selector: ".monitoring-result"})).toHaveLength(19);
  expect(screen.getByText("Vista previa · conexión pendiente")).toBeInTheDocument();
  expect(screen.getAllByText("—", {selector: "strong"})).toHaveLength(4);
});

it("separa no aplica de sin evaluar, conserva tratamientos y filtra resultados", () => {
  render(<MonitoringSection records={records} />);
  fireEvent.change(screen.getByLabelText("Fecha"), {target: {value: "2026-08-01"}});
  const summary = screen.getByLabelText("Resumen del registro completo");
  expect(within(summary).getByText("16")).toBeInTheDocument();
  expect(screen.getByText("Corrección")).toBeInTheDocument();
  expect(screen.getByText("200 ml")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Resultado"), {target: {value: "FAIL"}});
  expect(screen.getAllByText("No cumple", {selector: ".monitoring-result"})).toHaveLength(1);
  expect(screen.queryByText("Deshierbe y guadaña")).not.toBeInTheDocument();
  expect(screen.getByText("Observación del bloque")).toBeInTheDocument();
});

it("conserva el campo de origen de septiembre y distingue filtros vacíos", () => {
  render(<MonitoringSection records={records} />);
  expect(screen.getByText("100 ml")).toBeInTheDocument();
  expect(screen.getByText("Director de prueba")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Responsable"), {target: {value: "Responsable A"}});
  expect(screen.getByText("200 ml")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Fecha"), {target: {value: "2026-09-11"}});
  expect(screen.getByText("No hay monitoreos para estos filtros.")).toBeInTheDocument();
  expect(screen.queryByText("200 ml")).not.toBeInTheDocument();
});
