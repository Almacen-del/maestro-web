import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {DisabledNurseryRepository, SupabaseNurseryRepository} from "./shared/data/SupabaseNurseryRepository";
import type {NurseryRepository} from "./shared/domain/NurseryRepository";
import {WebApp} from "./WebApp";
import {loadSupabaseConfig} from "./supabaseConfig";

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el contenedor de Vivero Maestro Web.");

let repository: NurseryRepository;
let configurationError: string | undefined;
try {
  repository = SupabaseNurseryRepository.create(loadSupabaseConfig());
} catch (error) {
  configurationError = error instanceof Error
    ? error.message : "Configuración inválida. La aplicación permanece desconectada.";
  repository = new DisabledNurseryRepository();
}

createRoot(root).render(<StrictMode><WebApp repository={repository} configurationError={configurationError} /></StrictMode>);
