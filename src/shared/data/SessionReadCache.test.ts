import {expect, it, vi} from "vitest";
import {SessionReadCache} from "./SessionReadCache";

it("comparte solicitudes simultáneas y permite refrescar", async () => {
  const cache = new SessionReadCache();
  const load = vi.fn().mockResolvedValue(10);
  const first = cache.read("admin:catalog", load, true);
  expect(cache.read("admin:catalog", load, true)).toBe(first);
  await first;
  await cache.read("admin:catalog", load, true);
  expect(load).toHaveBeenCalledTimes(1);
  await cache.read("admin:catalog", load, false);
  expect(load).toHaveBeenCalledTimes(2);
});

it("separa usuarios, elimina errores y descarta caché al invalidar", async () => {
  const cache = new SessionReadCache();
  const load = vi.fn().mockResolvedValue(1);
  await cache.read("a", load, true);
  await cache.read("b", load, true);
  cache.clear();
  await cache.read("a", load, true);
  expect(load).toHaveBeenCalledTimes(3);
  await expect(cache.read("error", () => Promise.reject(new Error("fallo")), true)).rejects.toThrow("fallo");
  expect(await cache.read("error", load, true)).toBe(1);
});

it("expira sin persistir datos", async () => {
  vi.useFakeTimers();
  try {
    const cache = new SessionReadCache();
    const load = vi.fn().mockResolvedValue(1);
    await cache.read("a", load, true);
    vi.advanceTimersByTime(30_001);
    await cache.read("a", load, true);
    expect(load).toHaveBeenCalledTimes(2);
  } finally { vi.useRealTimers(); }
});
