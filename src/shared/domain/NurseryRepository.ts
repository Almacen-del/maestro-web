import type {MonitorRepository} from "./MonitorModels";
import type {DailyActivity} from "./DailyActivityContract";
import type {ApplicationRecord} from "../presentation/ApplicationsSection";
import type {MonitoringRecord} from "../presentation/MonitoringSection";
import type {GraftingRecord} from "../presentation/GraftingSection";
import type {InventoryHistoryRepository} from "./InventoryHistory";

export interface NurseryRecords {
  readonly activities: readonly DailyActivity[];
  readonly applications: readonly ApplicationRecord[];
  readonly monitoring: readonly MonitoringRecord[];
  readonly grafting: readonly GraftingRecord[];
}
export type DocumentKind = "DAILY" | "APPLICATIONS" | "MONITORING" | "GRAFTING";
export type NurseryDocument = DailyActivity | ApplicationRecord | MonitoringRecord | GraftingRecord;
export type NurseryRepository = Pick<MonitorRepository,
  "environment" | "emulatorEnabled" | "signIn" | "signOut" | "restoreSession" |
  "observeAccountStatus" | "listManageableCatalog" | "listManageableLots" | "listDailyActivities"
> & Partial<InventoryHistoryRepository> & {
  listNurseryRecords?(kind?: DocumentKind): Promise<NurseryRecords>;
  observeDataChanges?(onChange: () => void): () => void;
  saveDocument?(kind: DocumentKind, document: NurseryDocument, expectedVersion?: number): Promise<void>;
};
