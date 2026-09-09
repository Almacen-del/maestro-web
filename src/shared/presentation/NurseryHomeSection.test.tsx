import {render, screen, waitFor} from "@testing-library/react";
import {expect, it, vi} from "vitest";
import {DisabledMonitorRepository} from "../data/FirebaseMonitorRepository";
import {NurseryHomeSection} from "./NurseryHomeSection";

it("muestra existencias reales, proceso y espacios de fotos sin consultar otros módulos", async () => {
  const repository = Object.assign(new DisabledMonitorRepository(), {
    listManageableCatalog: vi.fn().mockResolvedValue({locations: [], lines: [
      {active: true, inventory: {total: 130}}, {active: false, inventory: {total: 900}}, {active: true},
    ]}), listManageableLots: vi.fn(),
  });
  render(<NurseryHomeSection repository={repository} />);
  expect(await screen.findByText("130")).toBeInTheDocument();
  expect(screen.getByText("1 líneas sin inventario registrado")).toBeInTheDocument();
  expect(screen.getByText("Germinación")).toBeInTheDocument();
  expect(screen.getByText("Plantas de cacay")).toBeInTheDocument();
  expect(screen.getAllByText(/Espacio reservado para una fotografía real/)).toHaveLength(3);
  expect(repository.listManageableLots).not.toHaveBeenCalled();
});

it("no presenta cero como inventario si falla la consulta", async () => {
  const repository = Object.assign(new DisabledMonitorRepository(), {listManageableCatalog: vi.fn().mockRejectedValue(new Error("internal"))});
  render(<NurseryHomeSection repository={repository} />);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No fue posible consultar"));
  expect(screen.getByText("—")).toBeInTheDocument();
  expect(screen.queryByText("0")).not.toBeInTheDocument();
});
