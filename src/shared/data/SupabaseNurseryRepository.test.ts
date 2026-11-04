import {createClient} from "@supabase/supabase-js";
import {describe,expect,it,vi} from "vitest";
import {SupabaseNurseryRepository,validateDocument} from "./SupabaseNurseryRepository";

function setup(data: Record<string,unknown[]>) {
  const fetcher=vi.fn(async(input: RequestInfo|URL)=>{
    const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
    const table=url.pathname.split("/").at(-1)!;
    let rows=data[table]??[];
    for(const [key,value] of url.searchParams)if(value.startsWith("eq."))rows=rows.filter(row=>String((row as Record<string,unknown>)[key])===value.slice(3));
    const offset=Number(url.searchParams.get("offset")??0),limit=Number(url.searchParams.get("limit")??500);
    return new Response(JSON.stringify(rows.slice(offset,offset+limit)),{status:200,headers:{"Content-Type":"application/json"}});
  });
  const client=createClient("https://gfgsnnweyfryfcqdnlvw.supabase.co","sb_publishable_test",{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:crypto.randomUUID()},global:{fetch:fetcher},
  });
  return {repo:new SupabaseNurseryRepository(client),fetcher,client};
}
describe("Repositorio Vivero",()=>{
  it("carga injertos y yemas históricos publicados y admite fecha ausente solo al leer el histórico",async()=>{
    const graft={id:"scan-graft",date:"",responsible:"",formType:"PV_F008_INJERTACION",samples:[],yemaCollections:[]};
    const bud={...graft,id:"scan-bud",date:"2026-03-02",formType:"PV_F007_YEMAS"};
    const {repo,fetcher}=setup({vivero_grafting_history:[{id:graft.id,payload:graft,published:true},{id:bud.id,payload:bud,published:true},{id:"hidden",payload:graft,published:false}]});
    expect((await repo.listNurseryRecords("GRAFTING")).grafting).toEqual([graft,bud]);
    expect(()=>validateDocument("GRAFTING",graft as never)).toThrow("fecha inválidos");
    fetcher.mockClear();
    await repo.listNurseryRecords("APPLICATIONS");
    expect(fetcher.mock.calls.some(([url])=>String(url).includes("vivero_grafting_history"))).toBe(false);
  });
  it("combina aplicaciones móviles e históricas publicadas conservando su origen",async()=>{
    const payload={id:"historical",date:"2026-07-07",product:"Producto original",location:"Módulo 1",applicationType:"Foliar",executor:"Ejecutor",dosePerLiter:"NOT_APPLICABLE",source:{file:"original.xlsx",sheet:"PV-F-001",row:5,columns:{H:"N.A"}}};
    const mobile={...payload,id:"mobile",source:undefined};
    const {repo,fetcher}=setup({vivero_applications_history:[{id:payload.id,record_date:payload.date,payload,published:true},{id:"hidden",payload,published:false}],vivero_documents:[{id:"mobile",kind:"APPLICATIONS",payload:mobile}]});
    expect((await repo.listNurseryRecords("APPLICATIONS")).applications).toEqual([mobile,payload]);
    expect(fetcher.mock.calls.some(([url])=>String(url).includes("published=eq.true"))).toBe(true);
    fetcher.mockClear();
    await repo.listNurseryRecords("DAILY");
    expect(fetcher.mock.calls.some(([url])=>String(url).includes("vivero_applications_history"))).toBe(false);
  });
  it("lee las 1133 filas históricas publicadas sin truncar y consulta por fecha",async()=>{
    const history=Array.from({length:1133},(_,i)=>({id:`h${i}`,record_date:i<2?"2026-11-03":"2026-01-01",published:true,payload:{id:`h${i}`,date:i<2?"2026-11-03":"2026-01-01",title:"Riego",start:"",end:"",location:"M1",collaborators:["Colaborador"],notes:"",quantity:i===0?undefined:0}}));
    const {repo,fetcher}=setup({vivero_daily_history:[...history,{...history[0],id:"not-published",published:false}]});
    const all=await repo.listNurseryRecords("DAILY");
    expect(all.activities).toHaveLength(1133);
    expect(all.activities[0]?.quantity).toBeUndefined();
    expect(all.activities[1]?.quantity).toBe(0);
    expect(all.activities[0]?.recordedByName).toBeUndefined();
    expect(await repo.listDailyActivities("2026-11-03")).toHaveLength(2);
    fetcher.mockClear();
    await repo.listNurseryRecords("APPLICATIONS");
    expect(fetcher.mock.calls.some(([url])=>String(url).includes("vivero_daily_history"))).toBe(false);
  });
  it("integra históricos de monitoreo conservando responsable, fecha y criterios sin evaluar",async()=>{
    const payload={id:"historico-monitoreo-2026-06-08",date:"2026-06-08",responsible:"Responsable original",groups:[{id:"watering",criteria:[{index:0,status:"UNASSESSED"}]}]};
    const {repo,fetcher}=setup({vivero_monitoring_history:[{id:payload.id,record_date:payload.date,payload}]});
    expect((await repo.listNurseryRecords("MONITORING")).monitoring).toEqual([payload]);
    fetcher.mockClear();
    expect((await repo.listNurseryRecords("APPLICATIONS")).monitoring).toEqual([]);
    expect(fetcher.mock.calls.some(([url])=>String(url).includes("vivero_monitoring_history"))).toBe(false);
  });
  it("consulta únicamente tablas vivero y distingue cero de ausencia de inventario",async()=>{
    const {repo,fetcher}=setup({
      vivero_locations:[{id:"bed",code:"C1",display_name:"Cama 1",type:"CAMA",sort_order:1,active:true,version:1}],
      vivero_lines:[{id:"L1",location_id:"bed",code:"L1",display_name:"Línea 1",sort_order:1,active:true,version:1},
        {id:"L2",location_id:"bed",code:"L2",display_name:"Línea 2",sort_order:2,active:true,version:1}],
      vivero_inventory_effective:[{id:"L1",females:0,males:0,rootstocks:0,total:0,dead:2,responsible_name:"Responsable",updated_by:"user",updated_at:"2026-11-03",version:1}],
    });
    const data=await repo.listManageableCatalog();
    expect(data.lines[0].inventory?.total).toBe(0);
    expect(data.lines[1].inventory).toBeUndefined();
    expect(data.lines[0].inventory?.actorDisplayName).toBe("Responsable");
    for(const [input] of fetcher.mock.calls)expect(String(input)).toContain("/rest/v1/vivero_");
    await repo.listManageableCatalog(true);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("conecta todas las vistas sin inventar datos",async()=>{
    const {repo}=setup({});
    expect(await repo.listNurseryRecords()).toEqual({activities:[],applications:[],monitoring:[],grafting:[]});
  });
  it("al cerrar sesión no cierra las sesiones de Almacén",async()=>{
    const {repo,client}=setup({});
    const signOut=vi.spyOn(client.auth,"signOut").mockResolvedValue({error:null});
    await repo.signOut();
    expect(signOut).toHaveBeenCalledWith({scope:"local"});
  });
  it("rechaza documentos malformados",()=>{
    expect(()=>validateDocument("DAILY",{id:"x",date:"2026-11-03"} as never)).toThrow("diario inválido");
    expect(()=>validateDocument("MONITORING",{id:"x",date:"2026-11-03",responsible:"A",groups:[{id:"watering",criteria:[{index:0,status:"FALSE_PASS"}]}]} as never)).toThrow("Monitoreo inválido");
  });
  it("lee solo el corte solicitado y conserva fecha, responsable, cero y origen",async()=>{
    const {repo,fetcher}=setup({
      vivero_inventory_periods:[{id:"2026-04",published:true,source_file:"original.xlsx",expected_rows:1,expected_live:0,expected_dead:2}],
      vivero_locations:[{id:"G3",code:"G3",display_name:"Germinador 3",type:"GERMINADOR",active:true}],
      vivero_lines:[{id:"L1",code:"L1",location_id:"bed-new",display_name:"Línea 1",active:false}],
      vivero_inventory_history:[{id:"2026-04:L1",period_id:"2026-04",line_id:"L1",location_id:"G3",females:0,males:0,rootstocks:0,total:0,dead:2,counted_on:"2026-04-08",responsible_name:"Responsable original",updated_by:"importer",updated_at:"2026-11-03",source_sheet:"G3",source_row:10,version:1},
        {id:"other",period_id:"2026-09",line_id:"L1",total:9}],
    });
    const result=await repo.listHistoricalInventory("2026-04");
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({active:true,locationId:"G3",inventory:{total:0,initialDeadPlants:2,countedOn:"2026-04-08",actorDisplayName:"Responsable original",sourceFile:"original.xlsx",sourcePeriod:"2026-04",sourceRow:10}});
    expect(fetcher.mock.calls.some(([input])=>String(input).includes("period_id=eq.2026-04"))).toBe(true);
  });
  it("rechaza cortes incompletos en lugar de mostrar totales parciales como completos",async()=>{
    const {repo}=setup({vivero_inventory_periods:[{id:"2026-04",published:true,expected_rows:2,expected_live:9,expected_dead:0}]});
    await expect(repo.listHistoricalInventory("2026-04")).rejects.toThrow("corte completo");
    await expect(repo.listHistoricalInventory("2026-13")).rejects.toThrow("Período inválido");
  });
});
