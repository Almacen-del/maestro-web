export interface AndroidDailyDraft {
  readonly id: string;
  readonly date: string;
  readonly activity: string;
  readonly locations: readonly {readonly place: string; readonly beds: string; readonly lines: string}[];
  readonly workers: readonly {readonly name: string; readonly start: string; readonly end: string; readonly quantity: string}[];
  readonly individualHours: boolean;
  readonly start: string;
  readonly end: string;
  readonly individualQuantity: boolean;
  readonly quantity: string;
  readonly unit: string;
  readonly notes: string;
}

export interface DailyActivity {
  readonly recordedByName?: string;
  readonly id: string;
  readonly title: string;
  readonly date: string;
  readonly start: string;
  readonly end: string;
  readonly location: string;
  readonly collaborators: readonly string[];
  readonly plants?: number;
  readonly quantity?: number;
  readonly unit?: string;
  readonly individualHours?: boolean;
  readonly workerDetails?: readonly {readonly name: string; readonly start: string; readonly end: string; readonly quantity?: number}[];
  readonly notes: string;
}

export function parseAndroidDaily(value: unknown): AndroidDailyDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Registro diario inválido");
  const record = value as Record<string, unknown>;
  for (const key of ["id", "date", "activity", "start", "end", "quantity", "unit", "notes"]) {
    if (typeof record[key] !== "string") throw new Error("Campo diario inválido");
  }
  if (typeof record.individualHours !== "boolean" || typeof record.individualQuantity !== "boolean") throw new Error("Modo diario inválido");
  for (const [key, fields] of [["locations", ["place", "beds", "lines"]], ["workers", ["name", "start", "end", "quantity"]]] as const) {
    const entries = record[key];
    if (!Array.isArray(entries) || entries.length > 100 || !entries.every((entry: unknown) => entry && typeof entry === "object" && fields.every((field) => typeof (entry as Record<string, unknown>)[field] === "string"))) throw new Error("Detalle diario inválido");
  }
  return record as unknown as AndroidDailyDraft;
}

function count(value: string): number | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  const result = Number(value);
  return Number.isSafeInteger(result) && result <= 1_000_000_000 ? result : undefined;
}

/** Converts already validated mobile data; does not upload or mark a draft synchronized. */
export function dailyActivityFromAndroid(draft: AndroidDailyDraft): DailyActivity {
  const quantities = draft.workers.map((worker) => count(worker.quantity));
  const sum = quantities.reduce<number>((total, value) => total + (value ?? 0), 0);
  const total = draft.individualQuantity
    ? quantities.length && quantities.every((value) => value !== undefined) && Number.isSafeInteger(sum) ? sum : undefined
    : count(draft.quantity);
  return {
    id: draft.id, date: draft.date, title: draft.activity,
    start: draft.individualHours ? "" : draft.start, end: draft.individualHours ? "" : draft.end,
    location: draft.locations.map((item) => [item.place, item.beds && `Camas: ${item.beds}`, item.lines && `Líneas: ${item.lines}`].filter(Boolean).join(" · ")).join("; "),
    collaborators: draft.workers.map((worker) => worker.name),
    quantity: total, unit: draft.unit, plants: draft.unit.trim().toLowerCase() === "plantas" ? total : undefined,
    individualHours: draft.individualHours,
    workerDetails: draft.workers.map((worker) => ({name: worker.name, start: draft.individualHours ? worker.start : draft.start, end: draft.individualHours ? worker.end : draft.end, quantity: draft.individualQuantity ? count(worker.quantity) : undefined})),
    notes: draft.notes,
  };
}
