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
const baseCatalog: ManageableCatalogData = {
  locations: [
    {id:"demo-m1",code:"M1",type:"MODULO",displayName:"Módulo DEMO 1",order:1,active:true,version:1,activeChildCount:1,activeLineCount:3},
    {id:"demo-c1",parentId:"demo-m1",code:"C1",type:"CAMA",displayName:"Cama 1",order:1,active:true,version:1,activeChildCount:0,activeLineCount:3},
  ],
  lines: [120,0,240].map((total,index) => ({id:`demo-l${index}`,locationId:"demo-c1",code:`L${index+1}`,displayName:`Línea DEMO ${index+1}`,order:index+1,active:true,version:1,occupiedByActiveJourney:false,draftSelectionCount:0,inventory:{females:total/2,males:0,rootstocks:total/2,total,initialDeadPlants:index,version:1,origin:"CONTEO",actorUserId:"demo-user",actorDisplayName:"Responsable DEMO",updatedAt:`${date}T12:00:00Z`}})),
};
const catalog: ManageableCatalogData = {
  locations: Array.from({length:5},(_,m)=>[
    {...baseCatalog.locations[0]!,id:`demo-m${m+1}`,code:`M${m+1}`,displayName:`Módulo DEMO ${m+1}`,order:m+1,activeChildCount:2,activeLineCount:10},
    ...Array.from({length:2},(_,b)=>({...baseCatalog.locations[1]!,id:`demo-m${m+1}-c${b+1}`,parentId:`demo-m${m+1}`,code:`C${b+1}`,displayName:`Cama ${b+1}`,order:b+1,activeLineCount:5})),
  ]).flat(),
  lines:Array.from({length:50},(_,i)=>{
    const total=i%7===0?0:100+i*6;
    return {...baseCatalog.lines[0]!,id:`demo-l${i+1}`,locationId:`demo-m${Math.floor(i/10)+1}-c${Math.floor(i%10/5)+1}`,code:`L${i%5+1}`,displayName:`Línea DEMO ${i+1}`,order:i%5+1,inventory:{...baseCatalog.lines[0]!.inventory!,total,females:total/2,males:0,rootstocks:total/2,initialDeadPlants:i%4,actorDisplayName:`Responsable DEMO ${i%5+1}`}};
  }),
};
const repository = Object.assign(new DisabledMonitorRepository(), {listManageableCatalog:async()=>catalog,listManageableLots:async()=>[]});
const activities: DailyActivity[] = ["Trasplante","Selección de plantas"].map((title,index)=>({id:`demo-d${index}`,title,date,start:"06:00",end:"12:00",location:"Módulo DEMO 1 · Cama 1",collaborators:["Colaborador DEMO A","Colaborador DEMO B"],plants:120+index*60,quantity:120+index*60,unit:"plantas",notes:"Registro ficticio para revisar la presentación.",recordedByName:"Responsable DEMO"}));
const applications: ApplicationRecord[] = [{id:"demo-a1",date,time:"08:00",location:"Módulo DEMO 1",beds:"1",lines:"1-3",product:"Producto ficticio — NO USAR",activeIngredient:"No aplica: demostración",applicationType:"Prueba visual",executor:"Colaborador DEMO A",recordedBy:"Responsable DEMO",observations:"Sin dosis reales ni recomendación de aplicación."}];
const monitoring: MonitoringRecord[] = [{id:"demo-mon1",date,responsible:"Responsable DEMO",observations:"Inspección ficticia",groups:monitoringTemplate.map(group=>({id:group.id,criteria:group.criteria.map((_,index)=>({index,status:index===0?"PASS":index===1?"FAIL":"NOT_APPLICABLE",observations:"Resultado de demostración"}))}))}];
const grafting: GraftingRecord[] = [
  {id:"demo-i1",formType:"PV_F008_INJERTACION",date,responsible:"Responsable DEMO",totalGraftsCount:100,evaluatedSamplesCount:10,samples:[{id:"demo-s1",sampleNumber:1,module:"Módulo DEMO 1",bed:"Cama 1",line:"L1",treeAge:"9 meses",rootstockCriteria:[{status:"C"},{status:"C"},{status:"NC",notes:"Observación ficticia"}],graftCriteria:[{status:"C"},{status:"C"},{status:"C"}]}],yemaCollections:[]},
  {id:"demo-y1",formType:"PV_F007_YEMAS",date,responsible:"Responsable DEMO",samples:[],yemaCollections:[{id:"demo-yc1",collectionDate:date,lot:"Origen DEMO",line:"L1",gender:"H",motherTree:"DEMO-01",yemaQuantity:25,criteria:[{status:"C"},{status:"C"},{status:"N.A"}]}]},
];
// Fixed-size synthetic data only; never sent to a remote repository.
const activitySeed=activities[0]!;
activities.splice(0,activities.length,...Array.from({length:50},(_,i)=>({...activitySeed,id:`demo-d${i+1}`,title:["Trasplante","Selección de plantas","Riego","Preparación de sustrato","Revisión de injertos"][i%5]!,location:`Módulo DEMO ${i%5+1} · Cama ${i%2+1}`,plants:50+i*3,quantity:50+i*3,recordedByName:`Responsable DEMO ${i%5+1}`})));
const applicationSeed=applications[0]!;
applications.splice(0,applications.length,...Array.from({length:50},(_,i)=>({...applicationSeed,id:`demo-a${i+1}`,product:`Producto ficticio ${i%8+1} — NO USAR`,location:`Módulo DEMO ${i%5+1}`,beds:String(i%2+1),executor:`Colaborador DEMO ${i%6+1}`,observations:`Prueba ${i+1}. Sin dosis reales ni recomendación de aplicación.`})));
const monitoringSeed=monitoring[0]!;
monitoring.splice(0,monitoring.length,...Array.from({length:50},(_,i)=>({...monitoringSeed,id:`demo-mon${i+1}`,responsible:`Responsable DEMO ${i%5+1}`,observations:`Inspección ficticia ${i+1}`,groups:monitoringSeed.groups.map(g=>({...g,criteria:g.criteria.map(c=>({...c,status:(["PASS","FAIL","NOT_APPLICABLE","UNASSESSED"] as const)[(c.index+i)%4]!}))}))})));
const graftSeed=grafting[0]!;
const budSeed=grafting[1]!;
grafting.splice(0,grafting.length,...Array.from({length:50},(_,i)=>[
  {...graftSeed,id:`demo-i${i+1}`,responsible:`Responsable DEMO ${i%5+1}`,samples:graftSeed.samples.map(s=>({...s,id:`demo-s${i+1}`,module:`Módulo DEMO ${i%5+1}`,bed:`Cama ${i%2+1}`,line:`L${i%5+1}`}))},
  {...budSeed,id:`demo-y${i+1}`,responsible:`Responsable DEMO ${i%5+1}`,yemaCollections:budSeed.yemaCollections.map(y=>({...y,id:`demo-yc${i+1}`,motherTree:`DEMO-${i+1}`,gender:i%2?"M":"H",yemaQuantity:i%9===0?0:20+i}))},
]).flat());
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
  return <section className="grafting-section"><h1>Informe general · DEMO</h1><p>{catalog.lines.reduce((sum,line)=>sum+(line.inventory?.total??0),0).toLocaleString("es-CO")} plantas · 50 líneas · 50 actividades · 50 aplicaciones · 50 monitoreos · 50 registros de injertos · 50 registros de yemas.</p><p>Resumen de prueba; el informe oficial todavía no está implementado.</p></section>;
}
