export type BuildEnvironment = Readonly<Record<string, string | undefined>>;

export interface ResolvedWebBuildEnvironment {
  readonly VITE_APP_ENV?: string;
  readonly VITE_USE_FIREBASE_EMULATORS?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
}

/**
 * Vercel's Firebase integration uses the SDK field names without VITE_.
 * They remain build-time public Firebase Web configuration, never runtime secrets.
 */
export function resolveWebBuildEnvironment(environment: BuildEnvironment): ResolvedWebBuildEnvironment {
  const onVercel = environment.VERCEL === "1" || Boolean(environment.VERCEL_ENV);
  return {
    VITE_APP_ENV: environment.VITE_APP_ENV ?? (onVercel ? "production" : undefined),
    VITE_USE_FIREBASE_EMULATORS: environment.VITE_USE_FIREBASE_EMULATORS ?? (onVercel ? "false" : undefined),
    VITE_FIREBASE_PROJECT_ID: environment.VITE_FIREBASE_PROJECT_ID ?? environment.projectId,
    VITE_FIREBASE_API_KEY: environment.VITE_FIREBASE_API_KEY ?? environment.apiKey,
    VITE_FIREBASE_APP_ID: environment.VITE_FIREBASE_APP_ID ?? environment.appId,
    VITE_FIREBASE_AUTH_DOMAIN: environment.VITE_FIREBASE_AUTH_DOMAIN ?? environment.authDomain,
  };
}
