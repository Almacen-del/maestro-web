import {render,screen,fireEvent,within} from "@testing-library/react";
import {it,expect} from "vitest";
import {DailyDashboard} from "./DailyDashboard";
it("filtra registros y abre detalles sin inventar estados",()=>{
  const base={date:"2026-09-12",start:"06:00",end:"12:00",location:"M1",collaborators:["Ana","Luis"],plants:10,quantity:10,unit:"plantas",notes:"Nota real",recordedByName:"Ana"};
  render(<DailyDashboard activities={[{...base,id:"1",title:"Trasplante"},{...base,id:"2",title:"Riego"}]} controls={null} status={null}/>);
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
  fireEvent.change(screen.getByRole("searchbox"),{target:{value:"Trasplante"}});
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button",{name:"Ver detalle: Trasplante"}));
  expect(within(screen.getByRole("dialog")).getByText("Nota real")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Cerrar detalle"}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("Aprobar")).not.toBeInTheDocument();
});
