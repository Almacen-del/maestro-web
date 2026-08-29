import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {DisabledMonitorRepository, FirebaseMonitorRepository} from "./shared/data/FirebaseMonitorRepository";
import type {MonitorRepository} from "./shared/domain/MonitorModels";
import {WebApp} from "./WebApp";
import {loadWebConfig} from "./webConfig";

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el contenedor de Vivero Maestro Web.");

let repository: MonitorRepository;
let configurationError: string | undefined;
try {
  repository = FirebaseMonitorRepository.create(loadWebConfig());
} catch (error) {
  configurationError = error instanceof Error
    ? error.message : "Configuración inválida. La aplicación permanece desconectada.";
  repository = new DisabledMonitorRepository(configurationError);
}

createRoot(root).render(<StrictMode><WebApp repository={repository} configurationError={configurationError} /></StrictMode>);
