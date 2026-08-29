import {afterEach, describe, expect, it, vi} from "vitest";
import {readFileSync} from "node:fs";
import {isAllowedReportUrl, webPlatform} from "./webPlatform";

afterEach(() => vi.restoreAllMocks());

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
