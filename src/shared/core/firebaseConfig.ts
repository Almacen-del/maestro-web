export type FirebaseEnvironment = "EMULATOR" | "PRODUCTION";

export interface FirebaseRuntimeConfig {
  readonly environment: FirebaseEnvironment;
  readonly projectId: string;
  readonly apiKey: string;
  readonly appId: string;
  readonly authDomain: string;
  readonly useEmulators: boolean;
  readonly emulatorHost: "127.0.0.1";
}

type ViteEnvironment = Readonly<Record<string, string | undefined>>;

export const PRODUCTION_PROJECT_ID = "viverocontrol-3f83f";

function required(environment: ViteEnvironment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Falta ${name} en la configuración local de Vivero Maestro.`);
  return value;
}

export function loadFirebaseConfig(environment: ViteEnvironment = import.meta.env): FirebaseRuntimeConfig {
  const appEnvironment = required(environment, "VITE_APP_ENV");
  const projectId = required(environment, "VITE_FIREBASE_PROJECT_ID");
  const apiKey = required(environment, "VITE_FIREBASE_API_KEY");
  const appId = required(environment, "VITE_FIREBASE_APP_ID");
  const authDomain = required(environment, "VITE_FIREBASE_AUTH_DOMAIN");
  const emulatorFlag = required(environment, "VITE_USE_FIREBASE_EMULATORS");
  if (emulatorFlag !== "true" && emulatorFlag !== "false") {
    throw new Error("VITE_USE_FIREBASE_EMULATORS debe ser true o false.");
  }
  const useEmulators = emulatorFlag === "true";

  if (appEnvironment === "emulator") {
    if (!useEmulators || !projectId.startsWith("demo-")) {
      throw new Error("El modo emulator exige emuladores y un proyecto demo-*.");
    }
    return {
      environment: "EMULATOR",
      projectId,
      apiKey,
      appId,
      authDomain,
      useEmulators: true,
      emulatorHost: "127.0.0.1",
    };
  }

  if (appEnvironment === "production") {
    if (useEmulators || projectId !== PRODUCTION_PROJECT_ID) {
      throw new Error(`El modo production solo admite ${PRODUCTION_PROJECT_ID} sin emuladores.`);
    }
    return {
      environment: "PRODUCTION",
      projectId,
      apiKey,
      appId,
      authDomain,
      useEmulators: false,
      emulatorHost: "127.0.0.1",
    };
  }

  throw new Error("VITE_APP_ENV debe ser emulator o production.");
}
