import {describe, expect, it} from "vitest";
import {loadWebConfig} from "./webConfig";

const emulator = {
  VITE_APP_ENV: "emulator", VITE_USE_FIREBASE_EMULATORS: "true",
  VITE_FIREBASE_PROJECT_ID: "demo-web", VITE_FIREBASE_API_KEY: "demo-key",
  VITE_FIREBASE_APP_ID: "demo-web-app", VITE_FIREBASE_AUTH_DOMAIN: "demo-web.firebaseapp.com",
};
const local = {protocol: "http:", hostname: "127.0.0.1"};
const production = {...emulator, VITE_APP_ENV: "production", VITE_USE_FIREBASE_EMULATORS: "false",
  VITE_FIREBASE_PROJECT_ID: "viverocontrol-3f83f"};

describe("configuración web aislada", () => {
  it("acepta emuladores únicamente en loopback", () => {
    expect(loadWebConfig(emulator, local).useEmulators).toBe(true);
    expect(() => loadWebConfig(emulator, {protocol: "https:", hostname: "web.example.invalid"})).toThrow(/localhost/);
  });
  it("acepta producción sin emuladores y con HTTPS", () => {
    expect(loadWebConfig(production, {protocol: "https:", hostname: "web.example.invalid"}).useEmulators).toBe(false);
  });
  it("rechaza proyecto distinto y combinación cruzada", () => {
    expect(() => loadWebConfig({...production, VITE_FIREBASE_PROJECT_ID: "otro-proyecto"}, local)).toThrow();
    expect(() => loadWebConfig({...production, VITE_USE_FIREBASE_EMULATORS: "true"}, local)).toThrow();
  });
  it("falla cerrado si falta configuración, sin valores por defecto productivos", () => {
    expect(() => loadWebConfig({}, local)).toThrow(/Falta VITE_APP_ENV/);
  });
  it("rechaza HTTP remoto y file para proteger la sesión", () => {
    expect(() => loadWebConfig(production, {protocol: "http:", hostname: "web.example.invalid"})).toThrow(/HTTPS/);
    expect(() => loadWebConfig(production, {protocol: "file:", hostname: ""})).toThrow(/HTTPS/);
  });
});
