import type {NurseryModule} from "./NurseryModules";
const paths:Record<NurseryModule,string>={
  HOME:"M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7",
  DAILY:"M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1M8 14l3 3 5-5",
  MONITORING:"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  APPLICATIONS:"M9 3h6M11 3v6L5 19a1 1 0 0 0 1 2h12a1 1 0 0 0 1-2L13 9V3M8 15h8M10 18h1M15 17h1",
  INVENTORY:"m3 7 9-4 9 4-9 4-9-4M3 7v10l9 4 9-4V7M12 11v10M7 5l9 4",
  GRAFTING:"M12 22V10M12 15C5 15 3 11 3 5c6 0 9 4 9 10M12 10C12 4 16 2 21 2c0 5-3 8-9 8M8 18l8-2",
  MAPS:"m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5M9 3v16M15 5v16",
  GENERAL_REPORT:"M4 3h11l5 5v13H4V3M15 3v5h5M8 17v-4M12 17V9M16 17v-6",
};
export function NurseryIcon({name}:{name:NurseryModule}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]}/></svg>;}
