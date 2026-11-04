import {describe,it,expect} from 'vitest';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {unzipSync,strFromU8} from 'fflate';
import {fillTemplate,type SheetTemplate} from './OfficialExport';
import {dailyPages,applicationPages,graftPages,monitoringPages,inventoryPages} from './officialExportMappings';
import {demoData} from './DemoNursery';
describe('Exportaciones oficiales',()=>{
 it('exporta las quince columnas históricas de aplicaciones sin perder texto, ceros ni vacíos',()=>{
   const sheets=[{name:'PV-F-001',path:'sheet.xml',allowed:[],start:5,capacity:20}];
   const [page]=applicationPages(sheets,[{id:'history',date:'2026-07-22',product:'Producto',location:'Módulo 1',executor:'Ejecutor',applicationType:'Foliar',dosePerLiter:2,source:{file:'original.xlsx',sheet:'PV-F-001',row:22,columns:{B:'6:00 am',C:'M1',D:1.2,E:'6-12',F:'Producto original',G:null,H:'2 ml',I:'ml',J:0,K:'N.A',L:'Foliar',M:null,N:'Ejecutor original',O:'Nota original'}}}]);
   expect(Object.keys(page!.cells['sheet.xml']!)).toHaveLength(15);
   expect(page?.cells['sheet.xml']).toMatchObject({B5:'6:00 am',C5:'M1',D5:1.2,E5:'6-12',F5:'Producto original',G5:null,H5:'2 ml',I5:'ml',J5:0,K5:'N.A',L5:'Foliar',M5:null,N5:'Ejecutor original',O5:'Nota original'});
 });
 it('exporta las once columnas originales del histórico sin convertir vacíos en cero',()=>{
   const sheets=[{name:'2026',path:'sheet.xml',allowed:[],start:5,capacity:20}];
   const [page]=dailyPages(sheets,[{id:'history',date:'2026-11-03',title:'Riego',start:'',end:'',location:'Módulo 1 · Cama 2',collaborators:['Ana'],notes:'',source:{file:'original.xlsx',sheet:'2026',row:7,columns:{B:'Ana',C:'riego',D:null,E:'12:10 p.m',F:'M1',G:2,H:24,I:1,J:null,K:'Observación original'}}}]);
   expect(page?.cells['sheet.xml']).toMatchObject({B5:'Ana',C5:'riego',D5:null,F5:'M1',G5:2,H5:24,I5:1,J5:null,K5:'Observación original'});
 });
 const manifest=JSON.parse(readFileSync('public/export-templates/manifest.json','utf8')) as Record<string,{sheets:SheetTemplate[]}>;
 const builds={daily:(s:SheetTemplate[])=>dailyPages(s,demoData.activities),applications:(s:SheetTemplate[])=>applicationPages(s,demoData.applications),monitoring:(s:SheetTemplate[])=>monitoringPages(s,demoData.monitoring[0]!),grafts:(s:SheetTemplate[])=>graftPages(s,demoData.grafting.find(r=>r.formType==='PV_F008_INJERTACION')!),buds:(s:SheetTemplate[])=>graftPages(s,demoData.grafting.find(r=>r.formType==='PV_F007_YEMAS')!),inventory:(s:SheetTemplate[])=>inventoryPages(s,demoData.catalog,demoData.catalog.lines)};
 for(const [kind,build] of Object.entries(builds))it(`rellena ${kind} preservando partes no editadas`,()=>{
   const sheets=manifest[kind]!.sheets;const bytes=new Uint8Array(readFileSync(`public/export-templates/${kind}.xlsx`));const source=unzipSync(bytes);const pages=build(sheets);expect(pages.length).toBeGreaterThan(0);
   for(const [i,page] of pages.entries()){
    const result=fillTemplate(bytes,sheets,page);const output=unzipSync(result);
    expect(Object.keys(output)).toEqual(Object.keys(source));
    for(const path of Object.keys(source)){if(!page.cells[path])expect(createHash('sha256').update(output[path]!).digest('hex')).toBe(createHash('sha256').update(source[path]!).digest('hex'));else{
      const before=strFromU8(source[path]!);const after=strFromU8(output[path]!);
      expect(after.match(/<mergeCells[\s\S]*?<\/mergeCells>/)?.[0]).toBe(before.match(/<mergeCells[\s\S]*?<\/mergeCells>/)?.[0]);
      expect(after).toContain('</worksheet>');
    }}
    if(i===0){mkdirSync('.export-preview',{recursive:true});writeFileSync(`.export-preview/${kind}.xlsx`,result);}
   }
 });
 it('rechaza escribir encabezados',()=>{const bytes=new Uint8Array(readFileSync('public/export-templates/daily.xlsx'));expect(()=>fillTemplate(bytes,manifest.daily!.sheets,{name:'bad',cells:{[manifest.daily!.sheets[0]!.path]:{C1:'cambiar titulo'}}})).toThrow('fuera del rango');});
});
