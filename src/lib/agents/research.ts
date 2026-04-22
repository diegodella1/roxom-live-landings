import { runJsonAgent } from "../openai";
import type { ImageCandidate, Source, SourceBoundFact } from "../types";
import { discoverSourceImages, discoverWikimediaImages } from "../source-images";
import { editorialSystem } from "./prompts";
import { fallbackSources } from "./fallbacks";

export type ResearchOutput = {
  topic: string;
  facts: SourceBoundFact[];
  sources: Source[];
  imageCandidates: ImageCandidate[];
  visualDirections: string[];
};

const normalizeResearch = async (output: ResearchOutput): Promise<ResearchOutput> => {
  const fallbackSourceUrl = output.sources[0]?.url ?? "https://diegodella.ar/landings";
  const generatedImageCandidates = (output.imageCandidates ?? []).filter(
    image => image.url?.startsWith("http") && output.sources.some(source => source.url === image.sourceUrl)
  );
  const discoveredImageCandidates = [
    ...await discoverSourceImages(output.sources),
    ...await discoverWikimediaImages(output.topic)
  ];
  const imageUrls = new Set<string>();
  return {
    ...output,
    facts: (output.facts as unknown[]).map(fact => {
      if (typeof fact === "string") return { claim: fact, sourceUrl: fallbackSourceUrl };
      const maybeFact = fact as Partial<SourceBoundFact>;
      return {
        claim: maybeFact.claim ?? "",
        sourceUrl: maybeFact.sourceUrl ?? fallbackSourceUrl
      };
    }),
    imageCandidates: [...generatedImageCandidates, ...discoveredImageCandidates].filter(image => {
      if (imageUrls.has(image.url)) return false;
      imageUrls.add(image.url);
      return true;
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
Find more than a headline: gather chronology, actors, numbers, official statements, market/geopolitical context, and what to watch next.
Image collection is mandatory when available. Collect photographic image candidates only when the image URL is directly associated with a returned source, such as a source article OpenGraph image, press image, company/government media image, or media kit image. Prefer large landscape images. Do not use icons, logos, avatars, trackers, base64 data URLs, SVGs, or unrelated stock images.
Return JSON:
{
  "topic": string,
  "facts": [{"claim": string, "sourceUrl": string}],
  "sources": [{"title": string, "outlet": string, "url": string, "publishedAt": string, "credibility": "tier1"|"tier2"|"unknown"}],
  "imageCandidates": [{"url": string, "title": string, "credit": string, "alt": string, "sourceUrl": string}],
  "visualDirections": string[]
}
Minimum four credible sources when available. Minimum eight source-bound facts when available. No unsupported claims.
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
        imageCandidates: [],
        visualDirections: ["Clean editorial cover image", "Source-backed timeline", "Minimal data panel"]
      };
    }
  }));
