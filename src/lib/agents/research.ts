import { runJsonAgent } from "../openai";
import type { Source, SourceBoundFact } from "../types";
import { editorialSystem } from "./prompts";
import { fallbackSources } from "./fallbacks";

export type ResearchOutput = {
  topic: string;
  facts: SourceBoundFact[];
  sources: Source[];
  visualDirections: string[];
};

const normalizeResearch = (output: ResearchOutput): ResearchOutput => {
  const fallbackSourceUrl = output.sources[0]?.url ?? "https://diegodella.ar/landings";
  return {
    ...output,
    facts: (output.facts as unknown[]).map(fact => {
      if (typeof fact === "string") return { claim: fact, sourceUrl: fallbackSourceUrl };
      const maybeFact = fact as Partial<SourceBoundFact>;
      return {
        claim: maybeFact.claim ?? "",
        sourceUrl: maybeFact.sourceUrl ?? fallbackSourceUrl
      };
    })
  };
};

export const runResearch = async (topic: string) =>
  normalizeResearch(await runJsonAgent<ResearchOutput>({
    agent: "research",
    system: editorialSystem,
    useWebSearch: true,
    prompt: `
Research this live news landing topic: "${topic}".
Use current web sources. Prefer AP, Reuters, Google News results, Bloomberg, BBC, NYT, FT, WSJ, CNBC, CoinDesk, and any other source deemed relevant by legacy and new media standards.
Every fact must be source-bound. Do not include a claim unless it has a sourceUrl from the returned sources list.
Return JSON:
{
  "topic": string,
  "facts": [{"claim": string, "sourceUrl": string}],
  "sources": [{"title": string, "outlet": string, "url": string, "publishedAt": string, "credibility": "tier1"|"tier2"|"unknown"}],
  "visualDirections": string[]
}
Minimum two credible sources when available. No unsupported claims.
`,
    fallback: () => {
      const sources = fallbackSources(topic);
      return {
        topic,
        facts: [
          {
            claim: `This pipeline is tracking ${topic} as a live story until stronger source coverage is available.`,
            sourceUrl: sources[0]?.url ?? "https://diegodella.ar/landings"
          },
          {
            claim: "Updates are only published after Critic approval.",
            sourceUrl: sources[0]?.url ?? "https://diegodella.ar/landings"
          }
        ],
        sources,
        visualDirections: ["Clean editorial cover image", "Source-backed timeline", "Minimal data panel"]
      };
    }
  }));
