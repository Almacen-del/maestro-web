import {fireEvent, render, screen, within} from "@testing-library/react";
import {beforeAll, expect, it} from "vitest";
beforeAll(() => {HTMLDialogElement.prototype.showModal = function () {this.setAttribute("open", "");};});
import {MonitoringSection, type MonitoringRecord} from "./MonitoringSection";
const records: MonitoringRecord[] = [
  {id:"a",date:"2026-08-01",responsible:"Ana",groups:[{id:"watering",criteria:[{index:0,status:"FAIL",observations:"Revisar riego"}]}]},
  {id:"b",date:"2026-09-01",responsible:"Luis",groups:[]},
];
it("abre solo fichas sin calificación y conserva el período y el detalle", () => {
  render(<MonitoringSection records={[...records,{id:"na",date:"2026-09-02",responsible:"No aplica",groups:[{id:"watering",criteria:[{index:0,status:"NOT_APPLICABLE"}]}]}]}/>);
  fireEvent.change(screen.getByLabelText("Desde"),{target:{value:"2026-09-01"}});
  fireEvent.click(screen.getByRole("button",{name:/Fichas sin calificación/}));
  const table=screen.getByRole("table",{name:"Historial de fichas sin calificación"});
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  expect(within(table).getByText("Luis")).toBeInTheDocument();
  expect(within(table).queryByText("No aplica")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Ver ficha del 2026-09-01 y exportar"}));
  expect(screen.getByRole("dialog",{name:"Ficha de monitoreo"})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Cerrar ficha"}));
  fireEvent.click(screen.getByRole("button",{name:/Volver al resumen/}));
  expect(screen.getByLabelText("Desde")).toHaveValue("2026-09-01");
});
it("abre solo las evaluaciones del proceso sin navegar al historial", () => {
  render(<MonitoringSection records={records}/>);
  fireEvent.click(screen.getByRole("button",{name:/^Riego/}));
  const dialog = screen.getByRole("dialog",{name:"Evaluaciones de Riego"});
  expect(within(dialog).getByText("Revisar riego")).toBeInTheDocument();
  expect(within(dialog).queryByText("Deshierbe y guadaña")).not.toBeInTheDocument();
  expect(screen.queryByText("Matriz de monitoreo")).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button",{name:"Cerrar evaluaciones"}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
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
  expect(screen.getByRole("dialog",{name:"Ficha de monitoreo"})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Cerrar ficha"}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Buscar")).toHaveValue("Ana");
});
it("no inventa registros y aplica rango de fechas", () => {
  render(<MonitoringSection records={records}/>);
  fireEvent.click(screen.getByRole("button",{name:"Historial"}));
  fireEvent.change(screen.getByLabelText("Desde"),{target:{value:"2027-01-01"}});
  expect(screen.getByText("No hay monitoreos para estos filtros.")).toBeInTheDocument();
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(1);
});
