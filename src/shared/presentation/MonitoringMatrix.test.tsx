import {fireEvent, render, screen, within} from "@testing-library/react";
import {expect, it} from "vitest";
import {MonitoringSection, type MonitoringRecord} from "./MonitoringSection";
const records: MonitoringRecord[] = [
  {id:"a",date:"2026-08-01",responsible:"Ana",groups:[{id:"watering",criteria:[{index:0,status:"FAIL",observations:"Revisar riego"}]}]},
  {id:"b",date:"2026-09-01",responsible:"Luis",groups:[]},
];
it("pagina varios registros y filtra por proceso y responsable", () => {
  render(<MonitoringSection records={records}/>);
  fireEvent.click(screen.getByRole("button",{name:"Historial"}));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(26);
  fireEvent.click(screen.getByRole("button",{name:"Siguiente"}));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(14);
  fireEvent.click(screen.getByRole("button",{name:"Riego"}));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(5);
  fireEvent.change(screen.getByLabelText("Buscar"),{target:{value:"Ana"}});
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
  fireEvent.change(screen.getByLabelText("Resultado"),{target:{value:"FAIL"}});
  expect(screen.getByText("Revisar riego")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Ver registro / exportar"}));
  expect(screen.getByText("Monitoreo de vivero")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:/Volver a la matriz/}));
  expect(screen.getByLabelText("Buscar")).toHaveValue("Ana");
});
it("no inventa registros y aplica rango de fechas", () => {
  render(<MonitoringSection records={records}/>);
  fireEvent.click(screen.getByRole("button",{name:"Historial"}));
  fireEvent.change(screen.getByLabelText("Desde"),{target:{value:"2027-01-01"}});
  expect(screen.getByText("No hay monitoreos para estos filtros.")).toBeInTheDocument();
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(1);
});
