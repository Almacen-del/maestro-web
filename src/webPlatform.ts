import type {ReportPlatform} from "./shared/presentation/InventoryReportsSection";

export function isAllowedReportUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["drive.google.com", "docs.google.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

export const webPlatform: ReportPlatform = {
  desktopOAuth: false,
  async prepareGoogleDriveOAuth() {
    const random = crypto.getRandomValues(new Uint8Array(64));
    const codeVerifier = btoa(String.fromCharCode(...random))
      .replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
    return {redirectUri: `${window.location.origin}/`, codeChallenge, codeVerifier};
  },
  async openGoogleDriveOAuth(authorizationUrl, preparation) {
    const url = new URL(authorizationUrl);
    const state = url.searchParams.get("state");
    if (url.origin !== "https://accounts.google.com" || !state) {
      throw new Error("Google devolvio una URL de autorizacion no valida.");
    }
    sessionStorage.setItem("vivero-drive-oauth", JSON.stringify({
      state,
      codeVerifier: preparation.codeVerifier,
      redirectUri: preparation.redirectUri,
      createdAt: Date.now(),
    }));
    window.location.assign(url.toString());
    return await new Promise<never>(() => undefined);
  },
  consumeGoogleDriveOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("code") && !params.has("error")) return undefined;
    const raw = sessionStorage.getItem("vivero-drive-oauth");
    sessionStorage.removeItem("vivero-drive-oauth");
    window.history.replaceState({}, document.title, `${window.location.pathname}`);
    if (!raw || params.get("error") === "access_denied") return {ok: false, errorCode: "CANCELLED"};
    try {
      const pending = JSON.parse(raw) as Record<string, unknown>;
      const picked = params.get("picked_file_ids")?.split(",").filter(Boolean) ?? [];
      if (
        pending.state !== params.get("state") || typeof pending.codeVerifier !== "string" ||
        typeof pending.redirectUri !== "string" || typeof pending.createdAt !== "number" ||
        Date.now() - pending.createdAt > 10 * 60 * 1000 || picked.length !== 1 ||
        params.get("scope") !== "https://www.googleapis.com/auth/drive.file" || !params.get("code")
      ) return {ok: false, errorCode: Date.now() - Number(pending.createdAt) > 10 * 60 * 1000
        ? "EXPIRED" : "INVALID_CALLBACK"};
      return {
        ok: true,
        state: params.get("state")!,
        authorizationCode: params.get("code")!,
        codeVerifier: pending.codeVerifier,
        redirectUri: pending.redirectUri,
        selectedFileIds: [picked[0]],
        grantedScope: "https://www.googleapis.com/auth/drive.file",
      };
    } catch {
      return {ok: false, errorCode: "INVALID_CALLBACK"};
    }
  },
  async openExternalUrl(url) {
    if (!isAllowedReportUrl(url)) return false;
    // Link navigation avoids storing tokens or exposing window.opener to the report.
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.referrerPolicy = "no-referrer";
    link.click();
    return true;
  },
};
