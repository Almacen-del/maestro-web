import {describe,expect,it} from "vitest";
import {loadSupabaseConfig} from "./supabaseConfig";
const env={VITE_SUPABASE_URL:"https://gfgsnnweyfryfcqdnlvw.supabase.co",VITE_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test"};
const page={protocol:"https:",hostname:"maestro-web-liard.vercel.app"};
describe("Configuración aislada",()=>{
  it("acepta solo la base autorizada y una clave pública",()=>expect(loadSupabaseConfig(env,page).url).toBe(env.VITE_SUPABASE_URL));
  it("rechaza otro proyecto",()=>expect(()=>loadSupabaseConfig({...env,VITE_SUPABASE_URL:"https://another.supabase.co"},page)).toThrow("base autorizada"));
  it("rechaza claves privadas y valores faltantes",()=>{
    expect(()=>loadSupabaseConfig({...env,VITE_SUPABASE_PUBLISHABLE_KEY:"sb_secret_no"},page)).toThrow("clave pública");
    expect(()=>loadSupabaseConfig({},page)).toThrow("Falta");
  });
  it("no permite HTTP fuera de localhost",()=>expect(()=>loadSupabaseConfig(env,{...page,protocol:"http:"})).toThrow("HTTPS"));
});
