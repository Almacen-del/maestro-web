import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {expect,it} from "vitest";
import {unzipSync,strFromU8} from "fflate";
import {inventoryPages} from "./officialExportMappings";
import {excelDate,fillTemplate,type SheetTemplate} from "./OfficialExport";
import type {ManageableCatalogData} from "../domain/MonitorModels";

it("exporta fechas del conteo y muertas en sus columnas; separa G2 de G3 sin cambiar el formato",()=>{
 const manifest=JSON.parse(readFileSync("public/export-templates/manifest.json","utf8"));
 const sheets=manifest.inventory.sheets as SheetTemplate[];
 const bytes=new Uint8Array(readFileSync("public/export-templates/inventory.xlsx"));
 const before=unzipSync(bytes);
 const catalog={locations:[{id:"g2",type:"GERMINADOR",code:"G2"},{id:"g3",type:"GERMINADOR",code:"G3"}],lines:[
  {id:"a",locationId:"g2",code:"L2",displayName:"Germinador 2",inventory:{rootstocks:2,females:3,males:4,total:9,initialDeadPlants:5,countedOn:"2026-04-08",updatedAt:"2026-11-03",sourcePeriod:"2026-04",actorDisplayName:"Responsable original"}},
  {id:"b",locationId:"g3",code:"L3",displayName:"Germinador 3",inventory:{rootstocks:76,females:272,males:0,total:348,initialDeadPlants:15,countedOn:"2026-04-08",updatedAt:"2026-11-03",sourcePeriod:"2026-04",actorDisplayName:"Responsable original"}},
 ]} as unknown as ManageableCatalogData;
 const hash=(value:Uint8Array)=>createHash("sha256").update(value).digest("hex");
 const pages=inventoryPages(sheets,catalog,catalog.lines);
 expect(pages).toHaveLength(2);
 const s=sheets.find(s=>s.name==="G3")!;
 expect(pages.map(p=>p.cells[s.path].C5)).toEqual(["G2","G3"]);
 expect(pages[0].cells[s.path]).toMatchObject({B8:excelDate("2026-04-08"),H8:5,H13:5,I5:"Responsable original"});
 expect(pages[1].cells[s.path]).toMatchObject({E8:76,F8:272,H8:15,H13:15});
 for(const p of pages){
  const output=unzipSync(fillTemplate(bytes,sheets,p));
  for(const [path,content] of Object.entries(before))if(!p.cells[path])expect(hash(output[path])).toBe(hash(content));
  const xml=strFromU8(output[s.path]);
  expect(xml).toContain('Responsable original');
  expect(xml).toContain(`<v>${excelDate("2026-04-08")}</v>`);
 }
 expect(hash(new Uint8Array(readFileSync("public/export-templates/inventory.xlsx")))).toBe(hash(bytes));
});
