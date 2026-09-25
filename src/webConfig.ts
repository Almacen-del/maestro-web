import {loadFirebaseConfig} from "./shared/core/firebaseConfig";

export function loadWebConfig(
  environment: Readonly<Record<string, string | undefined>> = __WEB_BUILD_ENV__,
  page: Pick<Location, "protocol" | "hostname"> = window.location,
) {
  const config = loadFirebaseConfig(environment);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(page.hostname);
  if (page.protocol !== "https:" && !(page.protocol === "http:" && loopback)) {
    throw new Error("Vivero Maestro Web requiere HTTPS o localhost. La conexión permanece deshabilitada.");
  }
  if (config.useEmulators && !loopback) {
    throw new Error("Los emuladores solo están habilitados al abrir la web desde localhost.");
  }
  return config;
}
