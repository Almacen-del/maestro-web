import {fileURLToPath} from "node:url";
import {loadEnv} from "vite";
import {defineConfig} from "vitest/config";
import {resolveWebBuildEnvironment} from "./src/buildEnvironment";

export default defineConfig(({mode}) => ({
  base: "./",
  // Mantiene una sola instancia de cada SDK dentro del paquete web autónomo.
  resolve: {dedupe: ["react", "react-dom", "firebase"]},
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  define: {
    __WEB_BUILD_ENV__: JSON.stringify(resolveWebBuildEnvironment(loadEnv(mode, process.cwd(), ""))),
  },
  build: {sourcemap: false},
  test: {
    pool: "threads",
    maxWorkers: 1,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
}));
