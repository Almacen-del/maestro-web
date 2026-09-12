import {render,screen} from "@testing-library/react";
import {describe,it,expect} from "vitest";
import {DemoNursery,demoData} from "./DemoNursery";
describe("Demostración aislada",()=>{
  it("muestra existencias ficticias sin repositorio productivo",async()=>{
    render(<DemoNursery module="INVENTORY"/>);
    expect(await screen.findByText("Línea DEMO 1")).toBeInTheDocument();
    expect(demoData.catalog.lines.reduce((n,line)=>n+(line.inventory?.total??0),0)).toBe(360);
  });
  it("exporta un conjunto identificable y serializable",()=>{
    const data=JSON.parse(JSON.stringify(demoData));
    expect(data.demo).toBe(true);
    expect(data.grafting).toHaveLength(2);
    expect(data.applications[0].product).toContain("NO USAR");
  });
});
