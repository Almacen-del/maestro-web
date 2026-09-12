import {render,screen} from "@testing-library/react";
import {describe,it,expect} from "vitest";
import {demoData} from "./DemoNursery";
import {GeneralReportSection,summarizeCatalog} from "./GeneralReportSection";
import {DisabledMonitorRepository} from "../data/FirebaseMonitorRepository";
describe("Informe general",()=>{
  it("agrupa las cincuenta líneas sin duplicar existencias",()=>{
    const rows=summarizeCatalog(demoData.catalog);
    expect(rows).toHaveLength(5);
    expect(rows.reduce((n,r)=>n+r.lines,0)).toBe(50);
    expect(rows.reduce((n,r)=>n+r.total,0)).toBe(demoData.catalog.lines.reduce((n,l)=>n+l.inventory!.total,0));
  });
  it("distingue una línea sin datos de una vacía",()=>{
    const rows=summarizeCatalog({...demoData.catalog,lines:[{...demoData.catalog.lines[0]!,inventory:undefined},demoData.catalog.lines[7]!]});
    expect(rows.reduce((n,r)=>n+r.missing,0)).toBe(1);
    expect(rows.reduce((n,r)=>n+r.empty,0)).toBe(1);
  });
  it("no inventa actividad productiva",async()=>{
    const repository=Object.assign(new DisabledMonitorRepository(),{listManageableCatalog:async()=>demoData.catalog});
    render(<GeneralReportSection repository={repository}/>);
    expect(await screen.findByRole("rowheader", {name:"Módulo DEMO 1"})).toBeInTheDocument();
    expect(screen.getByRole("meter", {name:"Plantas en Módulo DEMO 1"})).toBeInTheDocument();
    expect(screen.getByText(/La conexión productiva/)).toBeInTheDocument();
  });
});
