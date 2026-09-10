import {render, screen} from "@testing-library/react";
import {expect, it} from "vitest";
import {DailyProcessesSection} from "./DailyProcessesSection";

it("informa que no existe conexión y no inventa actividades", () => {
  render(<DailyProcessesSection />);
  expect(screen.getByText("Conexión pendiente")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("conexión");
  expect(screen.queryByText("Finalizado")).not.toBeInTheDocument();
});

it("distingue una fuente conectada sin registros", () => {
  render(<DailyProcessesSection activities={[]} />);
  expect(screen.getByRole("status")).toHaveTextContent("No hay actividades registradas");
});
