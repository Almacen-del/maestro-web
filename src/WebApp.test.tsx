import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import {DisabledNurseryRepository, emptyNurseryRecords} from "./shared/data/SupabaseNurseryRepository";
import type {NurseryRepository} from "./shared/domain/NurseryRepository";
import type {MonitorUser} from "./shared/domain/MonitorModels";
import {WebApp} from "./WebApp";

const admin: MonitorUser = {id:"admin",displayName:"Administrador",role:"ADMINISTRADOR",canReview:true,canRelease:false,
  canViewReservationDetails:false,canManageUsers:true,canManageCatalog:true,canManageDraftJourneys:false};
function repository(): NurseryRepository {
  return Object.assign(new DisabledNurseryRepository(), {
    environment:"PRODUCTION" as const, signIn:vi.fn().mockResolvedValue(admin),
    signOut:vi.fn().mockResolvedValue(undefined), observeAccountStatus:vi.fn(()=>()=>{}),
    restoreSession:vi.fn().mockResolvedValue(admin),
    listManageableCatalog:vi.fn().mockResolvedValue({locations:[],lines:[]}),
    listManageableLots:vi.fn().mockResolvedValue([]),
    listDailyActivities:vi.fn().mockResolvedValue([]),
    listNurseryRecords:vi.fn().mockResolvedValue(emptyNurseryRecords()),
  });
}
describe("Web productiva Supabase",()=>{
  it("restaura sin cabezal antiguo y no consulta datos antes de autorizar",()=>{
    const repo={...repository(),restoreSession:vi.fn(()=>new Promise<MonitorUser|undefined>(()=>{}))};
    const {container}=render(<WebApp repository={repo}/>);
    expect(screen.getByRole("status")).toHaveTextContent("Restaurando sesión");
    expect(container.querySelector(".topbar, .environment-banner")).toBeNull();
    expect(repo.listManageableCatalog).not.toHaveBeenCalled();
  });
  it("habilita los ocho módulos reales, sin pruebas simuladas ni jornadas",async()=>{
    const repo=repository();
    render(<WebApp repository={repo}/>);
    await screen.findByRole("button",{name:"Menú principal"});
    for(const name of ["Procesos diarios","Monitoreo","Control de aplicaciones","Inventario","Injertación","Mapas","Informe general"]) {
      expect(screen.getByRole("button",{name})).toBeEnabled();
    }
    expect(screen.queryByText("Ver datos de prueba")).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Jornadas"})).not.toBeInTheDocument();
    expect(repo.signIn).not.toHaveBeenCalled();
  });
  it("conecta las vistas operativas y el consolidado a la fuente real",async()=>{
    const repo=repository();
    render(<WebApp repository={repo}/>);
    await screen.findByRole("button",{name:"Monitoreo"});
    for(const [label,kind,title] of [["Monitoreo","MONITORING","Monitoreo del vivero"],
      ["Control de aplicaciones","APPLICATIONS","Control de aplicaciones"],
      ["Informe general",undefined,"Informe general"]] as const) {
      fireEvent.click(screen.getByRole("button",{name:label}));
      await screen.findByRole("heading",{name:title});
      expect(repo.listNurseryRecords).toHaveBeenLastCalledWith(kind);
    }
  });
  it("no interpreta un fallo de conexión como registros vacíos",async()=>{
    const repo={...repository(),listNurseryRecords:vi.fn().mockRejectedValue(new Error("network"))};
    render(<WebApp repository={repo}/>);
    fireEvent.click(await screen.findByRole("button",{name:"Monitoreo"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible consultar");
    expect(screen.queryByText("Sin fichas evaluadas para este período.")).not.toBeInTheDocument();
  });
  it("falla cerrado sin configuración o acceso autorizado",async()=>{
    const first=render(<WebApp repository={new DisabledNurseryRepository()} configurationError="Falta Supabase"/>);
    expect(screen.getByRole("button",{name:"Iniciar sesión"})).toBeDisabled();
    first.unmount();
    render(<WebApp repository={{...repository(),restoreSession:vi.fn().mockRejectedValue(new Error("Cuenta desactivada"))}}/>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Cuenta desactivada");
    expect(screen.queryByRole("button",{name:"Inventario"})).not.toBeInTheDocument();
  });
});
