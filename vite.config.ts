import {fileURLToPath} from "node:url";
import {defineConfig} from "vitest/config";

export default defineConfig({
  base: "./",
  // Mantiene una sola instancia de cada SDK dentro del paquete web autónomo.
  resolve: {dedupe: ["react", "react-dom", "firebase"]},
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  build: {sourcemap: false},
  test: {
    pool: "threads",
    maxWorkers: 1,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
