import type {ManageableCatalogData} from "./MonitorModels";

export interface InventoryPeriod {
  readonly id: string;
  readonly sourceFile: string;
  readonly firstCountedOn: string;
  readonly lastCountedOn: string;
  readonly records: number;
  readonly live: number;
  readonly dead: number;
}

export interface InventoryHistoryRepository {
  listInventoryPeriods(): Promise<readonly InventoryPeriod[]>;
  listHistoricalInventory(period: string): Promise<ManageableCatalogData>;
}

export function inventoryPeriodLabel(period: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return period;
  return new Date(`${period}-01T12:00:00Z`).toLocaleDateString("es-CO", {month: "long", year: "numeric", timeZone: "UTC"});
}
