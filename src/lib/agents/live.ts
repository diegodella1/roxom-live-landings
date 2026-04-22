import { hashValue } from "../hash";
import { runJsonAgent } from "../openai";
import type { LandingContent, LiveMonitorResult } from "../types";
import { editorialSystem } from "./prompts";
import { fallbackNoMaterialChange } from "./fallbacks";

export const runLiveMonitor = (content: LandingContent, landingId: number) =>
  runJsonAgent<LiveMonitorResult>({
    agent: "liveMonitor",
    landingId,
    system: editorialSystem,
    useWebSearch: true,
    prompt: `
Monitor this live landing for net-new verified updates.
Return JSON:
{
  "materiality": "NO_MATERIAL_CHANGE"|"MINOR"|"IMPORTANT"|"CRITICAL"|"BLOCKER",
  "summary": string,
  "delta": string,
  "sourceUrls": string[]
}
Only IMPORTANT or CRITICAL should update the public page.
Current landing:
${JSON.stringify(content)}
`,
    fallback: fallbackNoMaterialChange
  });

export const runLiveUpdater = (content: LandingContent, monitor: LiveMonitorResult, landingId: number) =>
  runJsonAgent<LandingContent>({
    agent: "liveUpdater",
    landingId,
    system: editorialSystem,
    prompt: `
Apply this verified live delta to the landing JSON. Preserve structure and source credits.
Return the full updated LandingContent JSON.
Current landing:
${JSON.stringify(content)}
Monitor result:
${JSON.stringify(monitor)}
`,
    fallback: () => ({
      ...content,
      lastUpdatedUtc: new Date().toISOString(),
      updateHistory: [
        {
          timestampUtc: new Date().toISOString(),
          materiality: monitor.materiality,
          summary: monitor.summary,
          sourceUrls: monitor.sourceUrls
        },
        ...content.updateHistory
      ]
    })
  });

export const deltaHash = (monitor: LiveMonitorResult) => hashValue(monitor);
