import type {ReportPlatform} from "./shared/presentation/InventoryReportsSection";

export function isAllowedReportUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["drive.google.com", "docs.google.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

export const webPlatform: ReportPlatform = {
  desktopOAuth: false,
  async openExternalUrl(url) {
    if (!isAllowedReportUrl(url)) return false;
    // Link navigation avoids storing tokens or exposing window.opener to the report.
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.referrerPolicy = "no-referrer";
    link.click();
    return true;
  },
};
