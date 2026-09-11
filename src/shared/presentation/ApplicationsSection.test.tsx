import {fireEvent, render, screen} from "@testing-library/react";
import {expect, it} from "vitest";
import {ApplicationsSection, type ApplicationRecord} from "./ApplicationsSection";

const records: readonly ApplicationRecord[] = [
  {id: "one", date: "2026-07-07", time: "06:00", location: "Módulo 1", beds: "1, 2", lines: "1-38", product: "Producto de prueba A", activeIngredient: "Ingrediente de prueba", dosePerLiter: 0.5, unit: "ml", waterLiters: 60, totalDose: 30, applicationType: "Foliar", executor: "Ejecutor A", recordedBy: "Usuario B", observations: "Observación de prueba"},
  {id: "two", date: "2026-08-03", location: "Jardín clonal", product: "Producto de prueba B", dosePerLiter: "NOT_APPLICABLE", unit: "g", waterLiters: "NOT_APPLICABLE", totalDose: 0, applicationType: "Edáfica", executor: "Ejecutor C"},
];

it("distingue la conexión pendiente de una consulta sin resultados", () => {
  const {rerender} = render(<ApplicationsSection />);
  expect(screen.getByText("Conexión pendiente")).toBeInTheDocument();
  expect(screen.queryByText("0")).not.toBeInTheDocument();
  rerender(<ApplicationsSection records={[]} />);
  expect(screen.getByText("No hay registros para estos filtros.")).toBeInTheDocument();
});

it("filtra por mes, ubicación, tipo y ejecutor y permite limpiar", () => {
  render(<ApplicationsSection records={records} />);
  fireEvent.change(screen.getByLabelText("Mes"), {target: {value: "2026-07"}});
  expect(screen.getByText("Producto de prueba A")).toBeInTheDocument();
  expect(screen.queryByText("Producto de prueba B")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Limpiar filtros"));
  fireEvent.change(screen.getByLabelText("Módulo / germinador / jardín"), {target: {value: "Jardín clonal"}});
  fireEvent.change(screen.getByLabelText("Tipo de aplicación"), {target: {value: "Edáfica"}});
  fireEvent.change(screen.getByLabelText("Buscar"), {target: {value: "ejecutor c"}});
  expect(screen.getByText("Producto de prueba B")).toBeInTheDocument();
  expect(screen.queryByText("Producto de prueba A")).not.toBeInTheDocument();
});

it("conserva unidades, no aplica, cero y separa ejecutor de quien registra", () => {
  render(<ApplicationsSection records={records} />);
  expect(screen.getByText("0,5 ml/L")).toBeInTheDocument();
  expect(screen.getByText("60 L")).toBeInTheDocument();
  expect(screen.getByText("30 ml")).toBeInTheDocument();
  expect(screen.getByText("0 g")).toBeInTheDocument();
  expect(screen.getAllByText("No aplica")).toHaveLength(2);
  expect(screen.getByText("Usuario B")).toBeInTheDocument();
  expect(screen.getByText("No disponible")).toBeInTheDocument();
});
