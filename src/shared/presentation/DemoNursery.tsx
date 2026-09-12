import {DisabledMonitorRepository} from "../data/FirebaseMonitorRepository";
import type {ManageableCatalogData} from "../domain/MonitorModels";
import {DailyProcessesSection, type DailyActivity} from "./DailyProcessesSection";
import {ApplicationsSection, type ApplicationRecord} from "./ApplicationsSection";
import {MonitoringSection, monitoringTemplate, type MonitoringRecord} from "./MonitoringSection";
import {GraftingSection, type GraftingRecord} from "./GraftingSection";
import {InventorySection} from "./InventorySection";
import {ModuleMapSection} from "./ModuleMapSection";
import {NurseryHomeSection} from "./NurseryHomeSection";
import type {NurseryModule} from "./NurseryModules";

const now = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
const catalog: ManageableCatalogData = {
  locations: [
    {id:"demo-m1",code:"M1",type:"MODULO",displayName:"Módulo DEMO 1",order:1,active:true,version:1,activeChildCount:1,activeLineCount:3},
    {id:"demo-c1",parentId:"demo-m1",code:"C1",type:"CAMA",displayName:"Cama 1",order:1,active:true,version:1,activeChildCount:0,activeLineCount:3},
  ],
  lines: [120,0,240].map((total,index) => ({id:`demo-l${index}`,locationId:"demo-c1",code:`L${index+1}`,displayName:`Línea DEMO ${index+1}`,order:index+1,active:true,version:1,occupiedByActiveJourney:false,draftSelectionCount:0,inventory:{females:total/2,males:0,rootstocks:total/2,total,initialDeadPlants:index,version:1,origin:"CONTEO",actorUserId:"demo-user",actorDisplayName:"Responsable DEMO",updatedAt:`${date}T12:00:00Z`}})),
};
const repository = Object.assign(new DisabledMonitorRepository(), {listManageableCatalog:async()=>catalog,listManageableLots:async()=>[]});
const activities: DailyActivity[] = ["Trasplante","Selección de plantas"].map((title,index)=>({id:`demo-d${index}`,title,date,start:"06:00",end:"12:00",location:"Módulo DEMO 1 · Cama 1",collaborators:["Colaborador DEMO A","Colaborador DEMO B"],plants:120+index*60,quantity:120+index*60,unit:"plantas",notes:"Registro ficticio para revisar la presentación.",recordedByName:"Responsable DEMO"}));
const applications: ApplicationRecord[] = [{id:"demo-a1",date,time:"08:00",location:"Módulo DEMO 1",beds:"1",lines:"1-3",product:"Producto ficticio — NO USAR",activeIngredient:"No aplica: demostración",applicationType:"Prueba visual",executor:"Colaborador DEMO A",recordedBy:"Responsable DEMO",observations:"Sin dosis reales ni recomendación de aplicación."}];
const monitoring: MonitoringRecord[] = [{id:"demo-mon1",date,responsible:"Responsable DEMO",observations:"Inspección ficticia",groups:monitoringTemplate.map(group=>({id:group.id,criteria:group.criteria.map((_,index)=>({index,status:index===0?"PASS":index===1?"FAIL":"NOT_APPLICABLE",observations:"Resultado de demostración"}))}))}];
const grafting: GraftingRecord[] = [
  {id:"demo-i1",formType:"PV_F008_INJERTACION",date,responsible:"Responsable DEMO",totalGraftsCount:100,evaluatedSamplesCount:10,samples:[{id:"demo-s1",sampleNumber:1,module:"Módulo DEMO 1",bed:"Cama 1",line:"L1",treeAge:"9 meses",rootstockCriteria:[{status:"C"},{status:"C"},{status:"NC",notes:"Observación ficticia"}],graftCriteria:[{status:"C"},{status:"C"},{status:"C"}]}],yemaCollections:[]},
  {id:"demo-y1",formType:"PV_F007_YEMAS",date,responsible:"Responsable DEMO",samples:[],yemaCollections:[{id:"demo-yc1",collectionDate:date,lot:"Origen DEMO",line:"L1",gender:"H",motherTree:"DEMO-01",yemaQuantity:25,criteria:[{status:"C"},{status:"C"},{status:"N.A"}]}]},
];
export const demoData = {demo:true,catalog,activities,applications,monitoring,grafting};
export function exportDemo() {
  const url=URL.createObjectURL(new Blob([JSON.stringify(demoData,null,2)],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;link.download="DEMO-vivero-datos-ficticios.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function DemoNursery({module}:{readonly module:NurseryModule}) {
  if(module==="HOME") return <NurseryHomeSection repository={repository}/>;
  if(module==="DAILY") return <DailyProcessesSection activities={activities}/>;
  if(module==="MONITORING") return <MonitoringSection records={monitoring}/>;
  if(module==="APPLICATIONS") return <ApplicationsSection records={applications}/>;
  if(module==="INVENTORY") return <InventorySection repository={repository}/>;
  if(module==="GRAFTING") return <GraftingSection records={grafting}/>;
  if(module==="MAPS") return <ModuleMapSection repository={repository} loading={false}/>;
  return <section className="grafting-section"><h1>Informe general · DEMO</h1><p>360 plantas · 2 actividades · 1 aplicación · 1 monitoreo · 2 registros de injertación/yemas.</p><p>Resumen de prueba; el informe oficial todavía no está implementado.</p></section>;
}
