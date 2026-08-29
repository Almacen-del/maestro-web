import {afterEach, describe, expect, it, vi} from "vitest";
import {readFileSync} from "node:fs";
import {isAllowedReportUrl, webPlatform} from "./webPlatform";

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("adaptador de navegador", () => {
  it.each(["https://drive.google.com/file/d/prueba/view", "https://docs.google.com/spreadsheets/d/prueba"])("abre destino permitido %s", async (url) => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function(this: HTMLAnchorElement) {
      expect(this.target).toBe("_blank");
      expect(this.rel).toBe("noopener noreferrer");
      expect(this.href).toBe(url);
    });
    expect(await webPlatform.openExternalUrl(url)).toBe(true);
    expect(click).toHaveBeenCalledOnce();
  });
  it.each(["javascript:alert(1)", "file:///secreto", "https://drive.google.com.evil.invalid/file", "https://usuario@drive.google.com/file", "http://drive.google.com/file", "https://drive.google.com:444/file", "no-url"])("rechaza %s", async (url) => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    expect(isAllowedReportUrl(url)).toBe(false);
    expect(await webPlatform.openExternalUrl(url)).toBe(false);
    expect(click).not.toHaveBeenCalled();
  });
  it("no ofrece OAuth de escritorio", () => expect(webPlatform.desktopOAuth).toBe(false));
  it("genera PKCE S256 para el retorno web", async () => {
    const preparation = await webPlatform.prepareGoogleDriveOAuth!();
    expect(preparation.redirectUri).toBe(`${window.location.origin}/`);
    expect(preparation.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/u);
    expect(preparation.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(preparation.codeChallenge).not.toBe(preparation.codeVerifier);
  });
  it("consume una sola vez el callback enlazado a state sin persistir tokens", () => {
    sessionStorage.setItem("vivero-drive-oauth", JSON.stringify({
      state: "estado-seguro",
      codeVerifier: "A".repeat(86),
      redirectUri: `${window.location.origin}/`,
      createdAt: Date.now(),
    }));
    window.history.replaceState({}, "", "/?state=estado-seguro&code=codigo-prueba&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file&picked_file_ids=archivo-prueba");
    const callback = webPlatform.consumeGoogleDriveOAuthCallback!();
    expect(callback).toMatchObject({ok: true, state: "estado-seguro", selectedFileIds: ["archivo-prueba"]});
    expect(sessionStorage.getItem("vivero-drive-oauth")).toBeNull();
    expect(window.location.search).toBe("");
    expect(webPlatform.consumeGoogleDriveOAuthCallback!()).toBeUndefined();
  });
  it("rechaza callback con state diferente", () => {
    sessionStorage.setItem("vivero-drive-oauth", JSON.stringify({
      state: "esperado",
      codeVerifier: "A".repeat(86),
      redirectUri: `${window.location.origin}/`,
      createdAt: Date.now(),
    }));
    window.history.replaceState({}, "", "/?state=otro&code=codigo-prueba&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file&picked_file_ids=archivo-prueba");
    expect(webPlatform.consumeGoogleDriveOAuthCallback!()).toEqual({ok: false, errorCode: "INVALID_CALLBACK"});
  });
  it("conserva CSP acotada y no depende de Electron", () => {
    const html = readFileSync("index.html", "utf8");
    const vercel = readFileSync("vercel.json", "utf8");
    for (const endpoint of ["identitytoolkit.googleapis.com", "securetoken.googleapis.com", "firestore.googleapis.com", "us-central1-viverocontrol-3f83f.cloudfunctions.net", "127.0.0.1:9099", "127.0.0.1:8180", "127.0.0.1:5001"]) {
      expect(html).toContain(endpoint);
    }
    expect(html).not.toMatch(/unsafe-eval|connect-src https:|\*\./);
    expect(html).toContain("script-src 'self'");
    expect(vercel).toContain("frame-ancestors 'none'");
    expect(vercel).not.toMatch(/unsafe-eval|connect-src https:|\*\./);
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect({...pkg.dependencies, ...pkg.devDependencies}).not.toHaveProperty("electron");
  });
});
