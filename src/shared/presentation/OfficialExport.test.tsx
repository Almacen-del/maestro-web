import {describe,it,expect} from 'vitest';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {unzipSync,strFromU8} from 'fflate';
import {fillTemplate,type SheetTemplate} from './OfficialExport';
import {dailyPages,applicationPages,graftPages,monitoringPages,inventoryPages} from './officialExportMappings';
import {demoData} from './DemoNursery';
describe('Exportaciones oficiales',()=>{
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
