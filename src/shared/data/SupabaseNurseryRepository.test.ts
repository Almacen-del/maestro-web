import {createClient} from "@supabase/supabase-js";
import {describe,expect,it,vi} from "vitest";
import {SupabaseNurseryRepository,validateDocument} from "./SupabaseNurseryRepository";

function setup(data: Record<string,unknown[]>) {
  const fetcher=vi.fn(async(input: RequestInfo|URL)=>{
    const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
    const table=url.pathname.split("/").at(-1)!;
    return new Response(JSON.stringify(data[table]??[]),{status:200,headers:{"Content-Type":"application/json"}});
  });
  const client=createClient("https://gfgsnnweyfryfcqdnlvw.supabase.co","sb_publishable_test",{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:crypto.randomUUID()},global:{fetch:fetcher},
  });
  return {repo:new SupabaseNurseryRepository(client),fetcher,client};
}
describe("Repositorio Vivero",()=>{
  it("consulta únicamente tablas vivero y distingue cero de ausencia de inventario",async()=>{
    const {repo,fetcher}=setup({
      vivero_locations:[{id:"bed",code:"C1",display_name:"Cama 1",type:"CAMA",sort_order:1,active:true,version:1}],
      vivero_lines:[{id:"L1",location_id:"bed",code:"L1",display_name:"Línea 1",sort_order:1,active:true,version:1},
        {id:"L2",location_id:"bed",code:"L2",display_name:"Línea 2",sort_order:2,active:true,version:1}],
      vivero_inventory:[{id:"L1",females:0,males:0,rootstocks:0,total:0,dead:2,responsible_name:"Responsable",updated_by:"user",updated_at:"2026-11-03",version:1}],
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
});
