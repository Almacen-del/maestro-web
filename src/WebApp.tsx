import type {MonitorRepository} from "./shared/domain/MonitorModels";
import {App} from "./shared/presentation/App";
import {webPlatform} from "./webPlatform";
import "./web.css";

export function WebApp({repository, configurationError}: {
  readonly repository: MonitorRepository;
  readonly configurationError?: string;
}) {
  return <>
    <div className="web-edition" role="note">VIVERO MAESTRO · VERSIÓN WEB</div>
    {configurationError && <p className="web-configuration-error" role="alert">{configurationError}</p>}
    <App repository={repository} reportPlatform={webPlatform} />
  </>;
}
