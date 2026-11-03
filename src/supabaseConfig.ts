export const VIVERO_SUPABASE_HOST = "gfgsnnweyfryfcqdnlvw.supabase.co";

export function loadSupabaseConfig(
  environment: Readonly<Record<string, string | undefined>> = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  },
  page: Pick<Location, "protocol" | "hostname"> = window.location,
) {
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(page.hostname);
  if (page.protocol !== "https:" && !(page.protocol === "http:" && loopback)) {
    throw new Error("Vivero requiere una conexión HTTPS.");
  }
  const rawUrl = environment.VITE_SUPABASE_URL?.trim();
  const key = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Falta configurar la conexión de Vivero con Supabase.");
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.hostname !== VIVERO_SUPABASE_HOST || url.port ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("La conexión no corresponde a la base autorizada de Arles.");
  }
  if (!key.startsWith("sb_publishable_")) {
    throw new Error("Vivero requiere una clave pública de Supabase, nunca una clave privada.");
  }
  return {url: url.origin, key};
}
