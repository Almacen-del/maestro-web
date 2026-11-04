import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import type {ManageableCatalogData, ManageableCatalogInventory, MonitorUser, ProductionLotSummary} from "../domain/MonitorModels";
import type {DocumentKind, NurseryDocument, NurseryRecords, NurseryRepository} from "../domain/NurseryRepository";
import type {DailyActivity} from "../domain/DailyActivityContract";
import type {InventoryPeriod} from "../domain/InventoryHistory";

type Table = "vivero_locations" | "vivero_lines" | "vivero_inventory_effective" | "vivero_inventory_periods" | "vivero_inventory_history" | "vivero_lots" | "vivero_lot_lines" | "vivero_documents" | "vivero_monitoring_history" | "vivero_daily_history" | "vivero_applications_history" | "vivero_grafting_history";
interface Stamp {id: string; version: number; updated_by: string; updated_at: string}
interface LocationRow extends Stamp {parent_id: string | null; code: string; display_name: string; type: string; sort_order: number; active: boolean}
interface LineRow extends Stamp {location_id: string; code: string; display_name: string; sort_order: number; active: boolean}
interface InventoryRow extends Stamp {females: number; males: number; rootstocks: number; dead: number; total: number; responsible_name: string; counted_on: string; origin?: string; source_period?: string; source_file?: string; source_sheet?: string; source_row?: number; observations?: string}
interface HistoryRow extends InventoryRow {period_id: string; line_id: string; location_id: string}
interface PeriodRow {id: string; source_file: string; first_counted_on: string; last_counted_on: string; expected_rows: number; expected_live: number; expected_dead: number}
interface LotRow extends Stamp {lot_type: "SIEMBRA" | "INJERTACION"; month: string; active: boolean}
interface LinkRow extends Stamp {lot_id: string; line_id: string}
interface DocumentRow extends Stamp {kind: DocumentKind; record_date: string; payload: NurseryDocument}

export const emptyNurseryRecords = (): NurseryRecords => ({activities: [], applications: [], monitoring: [], grafting: []});
const disconnected = "La conexión con Supabase no está configurada.";
function fail(message: string): never {throw new Error(message);}

export function validateDocument(kind: DocumentKind, value: NurseryDocument, allowUndatedHistory = false): void {
  const r = value as unknown as Record<string, unknown>;
  const strings = (keys: string[]) => keys.every(key => typeof r[key] === "string");
  const nonnegative = (key: string) => r[key] == null || (typeof r[key] === "number" && Number.isFinite(r[key]) && r[key] >= 0);
  if (!strings(["id", "date"]) || !r.id || (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) && !(allowUndatedHistory && kind === "GRAFTING" && r.date === ""))) fail("Identificador o fecha inválidos.");
  if (kind === "DAILY" && (!strings(["title","location","start","end","notes"]) || !Array.isArray(r.collaborators) || !r.collaborators.every(x => typeof x === "string") || !nonnegative("plants") || !nonnegative("quantity"))) fail("Proceso diario inválido.");
  if (kind === "APPLICATIONS" && !strings(["product","location","applicationType","executor"])) fail("Aplicación inválida.");
  if (kind === "MONITORING" && (!strings(["responsible"]) || !Array.isArray(r.groups) || !r.groups.every(g => g && typeof g.id === "string" && Array.isArray(g.criteria) && g.criteria.every((c: {index: number; status: string}) => Number.isInteger(c.index) && c.index >= 0 && ["PASS","FAIL","NOT_APPLICABLE","UNASSESSED"].includes(c.status))))) fail("Monitoreo inválido.");
  if (kind === "GRAFTING" && (!strings(["responsible"]) || !["PV_F008_INJERTACION","PV_F007_YEMAS"].includes(String(r.formType)) || !Array.isArray(r.samples) || !Array.isArray(r.yemaCollections))) fail("Registro de injertación inválido.");
}

export class SupabaseNurseryRepository implements NurseryRepository {
  readonly environment = "PRODUCTION" as const;
  readonly emulatorEnabled = false;
  private catalog?: {value: ManageableCatalogData; expires: number};
  private pendingCatalog?: Promise<ManageableCatalogData>;

  constructor(readonly client: SupabaseClient) {}
  static create(config: {url: string; key: string}) {
    return new SupabaseNurseryRepository(createClient(config.url, config.key, {
      auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "arles-vivero-supabase-v1"},
    }));
  }
  private async profile(id: string): Promise<MonitorUser> {
    const {data, error} = await this.client.from("vivero_members").select("user_id,display_name,role,active").eq("user_id", id).maybeSingle();
    if (error) fail("No fue posible verificar el acceso a Vivero. Revisa la conexión.");
    if (!data?.active || !["ADMINISTRADOR","SUPERVISOR","AUXILIAR"].includes(data.role)) fail("Esta cuenta no tiene acceso activo a Vivero.");
    const manager = data.role !== "AUXILIAR";
    return {id, displayName: data.display_name, role: data.role,
      canReview: manager, canRelease: false, canManageDraftJourneys: false,
      canManageUsers: data.role === "ADMINISTRADOR", canManageCatalog: manager, canViewReservationDetails: false};
  }
  async signIn(email: string, password: string) {
    this.catalog = undefined;
    const {data, error} = await this.client.auth.signInWithPassword({email: email.trim(), password});
    if (error || !data.user) fail("No fue posible ingresar. Usa el correo y la contraseña de Supabase.");
    try {return await this.profile(data.user.id);}
    catch (reason) {await this.client.auth.signOut({scope: "local"}); throw reason;}
  }
  async restoreSession() {
    const {data: session, error} = await this.client.auth.getSession();
    if (error) fail("No fue posible restaurar la sesión.");
    if (!session.session) return undefined;
    const {data, error: identityError} = await this.client.auth.getUser();
    if (identityError || !data.user) fail("La sesión ha vencido. Vuelve a ingresar.");
    return this.profile(data.user.id);
  }
  async signOut() {
    this.catalog = undefined;
    const {error} = await this.client.auth.signOut({scope: "local"});
    if (error) fail("No fue posible cerrar la sesión. Intenta de nuevo.");
  }
  observeDataChanges(onChange: () => void) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const changed = () => {
      this.catalog = undefined;
      if (timer) clearTimeout(timer);
      timer = setTimeout(()=>{if(!disposed)onChange();},350);
    };
    const channel = this.client.channel("vivero-data");
    for (const table of ["vivero_locations","vivero_lines","vivero_inventory","vivero_inventory_periods","vivero_lots","vivero_lot_lines","vivero_documents"]) {
      channel.on("postgres_changes",{event:"*",schema:"public",table},changed);
    }
    channel.subscribe();
    window.addEventListener("focus",changed);
    return () => {disposed=true;if(timer)clearTimeout(timer);window.removeEventListener("focus",changed);void this.client.removeChannel(channel);};
  }
  observeAccountStatus(id: string, onActive: (active: boolean) => void, onError: (message: string) => void) {
    let disposed = false;
    const check = async () => {
      if (document.visibilityState === "hidden") return;
      const {data,error} = await this.client.from("vivero_members").select("active").eq("user_id",id).maybeSingle();
      if (!disposed) {if (error) onError("No fue posible verificar la sesión."); else onActive(Boolean(data?.active));}
    };
    const {data} = this.client.auth.onAuthStateChange(event => {if (event === "SIGNED_OUT" && !disposed) onActive(false);});
    const onFocus = () => {void check();};
    window.addEventListener("focus",onFocus);
    const timer = window.setInterval(onFocus,60_000);
    return () => {disposed = true; data.subscription.unsubscribe(); window.clearInterval(timer); window.removeEventListener("focus",onFocus);};
  }
  private async rows<T>(table: Table, filters: Record<string,string> = {}, columns = "*"): Promise<T[]> {
    const result: T[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = this.client.from(table).select(columns).order("id").range(offset,offset + 499);
      for (const [key,value] of Object.entries(filters)) query = query.eq(key,value);
      const {data,error} = await query;
      if (error) fail("No fue posible consultar los datos de Vivero. Revisa la conexión y los permisos.");
      result.push(...data as unknown as T[]);
      if (data.length < 500) return result;
    }
  }
  async listManageableCatalog(reuse = false): Promise<ManageableCatalogData> {
    if (reuse && this.catalog && this.catalog.expires > Date.now()) return this.catalog.value;
    if (this.pendingCatalog) return this.pendingCatalog;
    this.pendingCatalog = this.loadCatalog();
    try {const value = await this.pendingCatalog; this.catalog = {value,expires:Date.now()+15_000}; return value;}
    finally {this.pendingCatalog = undefined;}
  }
  private async loadCatalog(): Promise<ManageableCatalogData> {
    const [locations,lines,inventory] = await Promise.all([
      this.rows<LocationRow>("vivero_locations"), this.rows<LineRow>("vivero_lines"), this.rows<InventoryRow>("vivero_inventory_effective"),
    ]);
    return this.catalogFromRows(locations,lines,inventory);
  }
  private catalogFromRows(locations: LocationRow[], lines: LineRow[], inventory: InventoryRow[]): ManageableCatalogData {
    const counts = new Map(inventory.map(row => [row.id,row]));
    return {
      locations: locations.map(row => ({id:row.id, code:row.code, type:row.type, parentId:row.parent_id ?? undefined,
        displayName:row.display_name, order:row.sort_order, active:row.active, version:row.version,
        activeChildCount:locations.filter(child=>child.parent_id===row.id && child.active).length,
        activeLineCount:lines.filter(line=>line.location_id===row.id && line.active).length})),
      lines: lines.map(row => {
        const stock = counts.get(row.id);
        const value: ManageableCatalogInventory | undefined = stock ? {females:stock.females,males:stock.males,rootstocks:stock.rootstocks,total:stock.total,
          version:stock.version,origin:stock.origin??"SUPABASE",actorUserId:stock.updated_by,actorDisplayName:stock.responsible_name,
          updatedAt:stock.updated_at,initialDeadPlants:stock.dead,initialSourceReference:stock.counted_on,
          countedOn:stock.counted_on,sourcePeriod:stock.source_period,sourceFile:stock.source_file,sourceSheet:stock.source_sheet,
          sourceRow:stock.source_row,observations:stock.observations} : undefined;
        return {id:row.id,locationId:row.location_id,code:row.code,displayName:row.display_name,order:row.sort_order,
          active:row.active,version:row.version,occupiedByActiveJourney:false,draftSelectionCount:0,inventory:value};
      }),
    };
  }
  async listInventoryPeriods(): Promise<readonly InventoryPeriod[]> {
    const periods = await this.rows<PeriodRow>("vivero_inventory_periods",{published:"true"},"id,source_file,first_counted_on,last_counted_on,expected_rows,expected_live,expected_dead");
    return periods.sort((a,b)=>b.id.localeCompare(a.id)).map(p=>({id:p.id,sourceFile:p.source_file,firstCountedOn:p.first_counted_on,
      lastCountedOn:p.last_counted_on,records:p.expected_rows,live:p.expected_live,dead:p.expected_dead}));
  }
  async listHistoricalInventory(period: string): Promise<ManageableCatalogData> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) fail("Período inválido.");
    const periods = await this.listInventoryPeriods();
    const selected = periods.find(p=>p.id===period);
    if (!selected) fail("El corte solicitado no está disponible.");
    const [locations,lines,history] = await Promise.all([
      this.rows<LocationRow>("vivero_locations"),this.rows<LineRow>("vivero_lines"),
      this.rows<HistoryRow>("vivero_inventory_history",{period_id:period},"id,period_id,line_id,location_id,females,males,rootstocks,dead,total,counted_on,responsible_name,observations,source_sheet,source_row,version,updated_by,updated_at"),
    ]);
    if (history.length!==selected.records || history.reduce((n,h)=>n+h.total,0)!==selected.live || history.reduce((n,h)=>n+h.dead,0)!==selected.dead) fail("No se pudo cargar el corte completo. Actualiza e intenta de nuevo.");
    const counts = new Map(history.map(h=>[h.line_id,h]));
    const places = new Map(locations.map(l=>[l.id,l]));
    const historicalLines = lines.filter(l=>counts.has(l.id)).map(l=>{
      const location = places.get(counts.get(l.id)!.location_id);
      // An old germinator sheet may not specify a bed; do not copy a later bed label into it.
      const display_name = location?.type==="GERMINADOR" ? `${location.display_name} · Línea ${l.code.replace(/^L/i,"")}` : l.display_name;
      return {...l,location_id:counts.get(l.id)!.location_id,display_name,active:true};
    });
    if (historicalLines.length!==history.length) fail("Faltan líneas del corte histórico.");
    return this.catalogFromRows(locations,historicalLines,history.map(h=>({...h,id:h.line_id,origin:"HISTORICO",source_period:period,source_file:selected.sourceFile})));
  }
  async listManageableLots(): Promise<readonly ProductionLotSummary[]> {
    const [lots,links,catalog] = await Promise.all([this.rows<LotRow>("vivero_lots"),this.rows<LinkRow>("vivero_lot_lines"),this.listManageableCatalog(true)]);
    return lots.map(lot => {
      const ids = links.filter(link=>link.lot_id===lot.id).map(link=>link.line_id);
      const lines = catalog.lines.filter(line=>ids.includes(line.id) && line.active);
      return {id:lot.id,lotType:lot.lot_type,displayName:lot.month,sowingDate:lot.month,state:lot.active?"ACTIVO":"FINALIZADO",
        version:lot.version,lineIds:ids,createdByUserId:lot.updated_by,createdAt:lot.updated_at,updatedAt:lot.updated_at,
        inventory:{females:lines.reduce((n,l)=>n+(l.inventory?.females??0),0),males:lines.reduce((n,l)=>n+(l.inventory?.males??0),0),
          rootstocks:lines.reduce((n,l)=>n+(l.inventory?.rootstocks??0),0),total:lines.reduce((n,l)=>n+(l.inventory?.total??0),0),
          linesWithInventory:lines.filter(l=>l.inventory).length,linesWithoutInventory:lines.filter(l=>!l.inventory).length}};
    });
  }
  async listNurseryRecords(kind?: DocumentKind): Promise<NurseryRecords> {
    const rows = await this.rows<DocumentRow>("vivero_documents",kind ? {kind} : {});
    if (!kind || kind === "DAILY") {
      const history = await this.rows<DocumentRow>("vivero_daily_history",{published:"true"},"id,record_date,payload");
      rows.push(...history.map(row => ({...row,kind:"DAILY" as const})));
    }
    if (!kind || kind === "MONITORING") {
      const data = await this.rows<DocumentRow>("vivero_monitoring_history",{},"id,record_date,payload");
      for (const history of data) rows.push({...history,kind:"MONITORING"} as DocumentRow);
    }
    if (!kind || kind === "APPLICATIONS") {
      const history = await this.rows<DocumentRow>("vivero_applications_history",{published:"true"},"id,record_date,payload");
      rows.push(...history.map(row => ({...row,kind:"APPLICATIONS" as const})));
    }
    const historicalGraftIds = new Set<string>();
    if (!kind || kind === "GRAFTING") {
      const history = await this.rows<DocumentRow>("vivero_grafting_history",{published:"true"},"id,record_date,payload");
      for (const row of history) {
        historicalGraftIds.add(row.id);
        rows.push({...row,kind:"GRAFTING"});
      }
    }
    const records = {activities:[] as DailyActivity[],applications:[] as NurseryRecords["applications"][number][],
      monitoring:[] as NurseryRecords["monitoring"][number][],grafting:[] as NurseryRecords["grafting"][number][]};
    for (const row of rows) {
      validateDocument(row.kind,row.payload,historicalGraftIds.has(row.id));
      if (row.kind==="DAILY") records.activities.push(row.payload as DailyActivity);
      if (row.kind==="APPLICATIONS") records.applications.push(row.payload as NurseryRecords["applications"][number]);
      if (row.kind==="MONITORING") records.monitoring.push(row.payload as NurseryRecords["monitoring"][number]);
      if (row.kind==="GRAFTING") records.grafting.push(row.payload as NurseryRecords["grafting"][number]);
    }
    return records;
  }
  async listDailyActivities(date: string): Promise<readonly DailyActivity[]> {
    const [current,history] = await Promise.all([
      this.rows<DocumentRow>("vivero_documents",{kind:"DAILY",record_date:date}),
      this.rows<DocumentRow>("vivero_daily_history",{record_date:date,published:"true"},"id,record_date,payload"),
    ]);
    const rows = [...current,...history];
    return rows.map(row=>{validateDocument("DAILY",row.payload);return row.payload as DailyActivity;});
  }
  async saveDocument(kind: DocumentKind, document: NurseryDocument, expectedVersion?: number): Promise<void> {
    validateDocument(kind,document);
    const value = {id:document.id,kind,record_date:document.date,payload:document,version:expectedVersion??1};
    const query = expectedVersion === undefined
      ? this.client.from("vivero_documents").insert(value)
      : this.client.from("vivero_documents").update(value).eq("id",document.id).eq("version",expectedVersion);
    const {data,error} = await query.select("id").maybeSingle();
    if (error || !data) fail("No se guardó. Revisa los permisos o actualiza el registro antes de intentarlo de nuevo.");
  }
}

export class DisabledNurseryRepository implements NurseryRepository {
  readonly environment = "DISABLED" as const;
  readonly emulatorEnabled = false;
  async signIn(): Promise<MonitorUser> {return fail(disconnected);}
  async signOut() {}
  observeAccountStatus() {return () => {};}
  async listManageableCatalog(): Promise<ManageableCatalogData> {return fail(disconnected);}
  async listManageableLots(): Promise<readonly ProductionLotSummary[]> {return fail(disconnected);}
}
