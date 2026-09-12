import {useState} from "react";
import {unzipSync,zipSync,strFromU8,strToU8} from "fflate";
export type TemplateKind="daily"|"applications"|"monitoring"|"grafts"|"buds"|"inventory";
export type CellValue=string|number|null|undefined;
export interface SheetTemplate {name:string;path:string;allowed:string[];start?:number;capacity?:number;column?:number;totalRow?:number}
export interface ExportPage {name:string;cells:Record<string,Record<string,CellValue>>}
type Manifest=Record<TemplateKind,{sheets:SheetTemplate[]}>;
const xmlEscape=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
export function fillTemplate(bytes:Uint8Array,sheets:readonly SheetTemplate[],page:ExportPage) {
  const zip=unzipSync(bytes);
  for(const [path,values] of Object.entries(page.cells)) {
    const sheet=sheets.find(s=>s.path===path);if(!sheet)throw new Error("Hoja no autorizada");
    const allowed=new Set(sheet.allowed);const pending=new Set(Object.keys(values));
    for(const ref of pending)if(!allowed.has(ref))throw new Error(`Celda fuera del rango de datos: ${ref}`);
    let xml=strFromU8(zip[path]!);
    xml=xml.replace(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g,cell=>{
      const ref=/\br="([A-Z]+\d+)"/.exec(cell)?.[1];if(!ref||!pending.has(ref))return cell;
      pending.delete(ref);const value=values[ref];let tag=cell.split(">")[0]!.replace(/\/$/,"").replace(/\s+t="[^"]*"/g,"");
      if(value==null||value==="")return cell.includes('<f')?cell:`${tag}/>`;
      if(typeof value==="number") {if(!Number.isFinite(value))throw new Error("Cantidad inválida");const formula=cell.match(/<f\b[^>]*>[\s\S]*?<\/f>/)?.[0]??"";return `${tag}>${formula}<v>${value}</v></c>`;}
      tag+=' t="inlineStr"';return `${tag}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    });
    if(pending.size)throw new Error(`El formato no contiene las celdas: ${[...pending].join(", ")}`);
    zip[path]=strToU8(xml);
  }
  return zipSync(zip);
}
export function OfficialExport({kind,build,disabled=false}:{readonly kind:TemplateKind;readonly build:(sheets:SheetTemplate[])=>ExportPage[];readonly disabled?:boolean}) {
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function download(){setBusy(true);setError("");try{
    const [manifestResponse,templateResponse]=await Promise.all([fetch('/export-templates/manifest.json'),fetch(`/export-templates/${kind}.xlsx`)]);
    if(!manifestResponse.ok||!templateResponse.ok)throw new Error("No fue posible descargar el formato.");
    const manifest=await manifestResponse.json() as Manifest;const sheets=manifest[kind].sheets;
    const pages=build(sheets);if(!pages.length)throw new Error("No hay datos seleccionados para exportar.");
    const template=new Uint8Array(await templateResponse.arrayBuffer());const files:Record<string,Uint8Array>={};
    const demo=JSON.stringify(pages).includes('DEMO');
    for(let i=0;i<pages.length;i++){const page=pages[i]!;files[`${demo?'DEMO-':''}${String(i+1).padStart(3,'0')}-${page.name.replace(/[^a-zA-Z0-9_-]/g,'-')}.xlsx`]=fillTemplate(template,sheets,page);}
    const bytes=pages.length===1?Object.values(files)[0]!:zipSync(files);
    const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:pages.length===1?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/zip'}));
    const a=document.createElement('a');a.href=url;a.download=pages.length===1?Object.keys(files)[0]!:`${demo?'DEMO-':''}${kind}-formatos.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError(e instanceof Error?e.message:'No se pudo exportar.');}finally{setBusy(false);}}
  return <div style={{margin:'12px 0'}}><button className="button button--secondary" type="button" disabled={disabled||busy} onClick={()=>void download()}>{busy?'Preparando Excel…':'Exportar formato Excel'}</button>{error&&<p role="alert">{error}</p>}</div>;
}
export const excelDate=(date?:string)=>date && /^\d{4}-\d{2}-\d{2}/.test(date)?(Date.parse(date.slice(0,10)+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000:undefined;
