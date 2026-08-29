import {describe, expect, it} from "vitest";
import {resolveWebBuildEnvironment} from "./buildEnvironment";

describe("configuración de build para Vercel", () => {
  it("adapta los nombres generados por Firebase en Vercel", () => {
    expect(resolveWebBuildEnvironment({
      VERCEL: "1",
      projectId: "viverocontrol-3f83f",
      apiKey: "public-web-key",
      appId: "public-web-app",
      authDomain: "viverocontrol-3f83f.firebaseapp.com",
    })).toEqual({
      VITE_APP_ENV: "production",
      VITE_USE_FIREBASE_EMULATORS: "false",
      VITE_FIREBASE_PROJECT_ID: "viverocontrol-3f83f",
      VITE_FIREBASE_API_KEY: "public-web-key",
      VITE_FIREBASE_APP_ID: "public-web-app",
      VITE_FIREBASE_AUTH_DOMAIN: "viverocontrol-3f83f.firebaseapp.com",
    });
  });

  it("prioriza los nombres VITE explícitos", () => {
    const resolved = resolveWebBuildEnvironment({
      VERCEL: "1",
      projectId: "legacy",
      VITE_FIREBASE_PROJECT_ID: "viverocontrol-3f83f",
      VITE_APP_ENV: "production",
      VITE_USE_FIREBASE_EMULATORS: "false",
    });
    expect(resolved.VITE_FIREBASE_PROJECT_ID).toBe("viverocontrol-3f83f");
    expect(resolved.VITE_APP_ENV).toBe("production");
  });

  it("no inventa producción fuera de Vercel", () => {
    expect(resolveWebBuildEnvironment({})).toEqual({
      VITE_APP_ENV: undefined,
      VITE_USE_FIREBASE_EMULATORS: undefined,
      VITE_FIREBASE_PROJECT_ID: undefined,
      VITE_FIREBASE_API_KEY: undefined,
      VITE_FIREBASE_APP_ID: undefined,
      VITE_FIREBASE_AUTH_DOMAIN: undefined,
    });
  });
});
