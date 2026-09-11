import {expect, it} from "vitest";
import {dailyActivityFromAndroid, type AndroidDailyDraft} from "./DailyActivityContract";
const draft: AndroidDailyDraft = {id: "stable-id", date: "2026-09-11", activity: "Actividad de prueba", locations: [{place: "Módulo 1", beds: "1,2", lines: "5,8,12"}], workers: [{name: "A", start: "06:00", end: "10:00", quantity: "2"}, {name: "B", start: "07:00", end: "11:00", quantity: "3"}], individualHours: false, start: "06:00", end: "12:00", individualQuantity: false, quantity: "10", unit: "plantas", notes: ""};
it("conserva ID, líneas discontinuas y total del equipo sin multiplicarlo", () => {
  const activity = dailyActivityFromAndroid(draft);
  expect(activity.id).toBe("stable-id");
  expect(activity.quantity).toBe(10);
  expect(activity.location).toContain("5,8,12");
  expect(activity.workerDetails?.[0].quantity).toBeUndefined();
});
it("suma cantidades individuales y conserva horarios y unidades no vegetales", () => {
  const activity = dailyActivityFromAndroid({...draft, individualQuantity: true, individualHours: true, unit: "actividades"});
  expect(activity.quantity).toBe(5);
  expect(activity.plants).toBeUndefined();
  expect(activity.start).toBe("");
  expect(activity.workerDetails?.[1].start).toBe("07:00");
});
it("no confunde una cantidad ausente con cero", () => {
  expect(dailyActivityFromAndroid({...draft, quantity: ""}).quantity).toBeUndefined();
  expect(dailyActivityFromAndroid({...draft, quantity: "0"}).quantity).toBe(0);
  expect(dailyActivityFromAndroid({...draft, individualQuantity: true, workers: [{...draft.workers[0], quantity: ""}]}).quantity).toBeUndefined();
});
