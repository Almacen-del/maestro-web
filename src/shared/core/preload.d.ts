export {};

declare global {
  interface Window {
    viveroFoundation?: {
      getRuntimeStatus: () => string;
      openExternalUrl: (url: string) => Promise<boolean>;
      prepareGoogleDriveOAuth: () => Promise<{
        readonly localSessionId: string;
        readonly redirectUri: string;
        readonly codeChallenge: string;
      }>;
      openGoogleDriveOAuth: (
        localSessionId: string,
        authorizationUrl: string,
      ) => Promise<
        | {
            readonly ok: true;
            readonly state: string;
            readonly authorizationCode: string;
            readonly codeVerifier: string;
            readonly redirectUri: string;
            readonly selectedFileIds: readonly [string];
            readonly grantedScope: "https://www.googleapis.com/auth/drive.file";
          }
        | {readonly ok: false; readonly errorCode: "CANCELLED" | "INVALID_CALLBACK" | "EXPIRED"}
      >;
    };
  }
}
