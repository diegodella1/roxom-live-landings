import { runJsonAgent } from "../openai";
import type { ImageCandidate, Source, SourceBoundFact } from "../types";
import { editorialSystem } from "./prompts";
import { fallbackSources } from "./fallbacks";

export type ResearchOutput = {
  topic: string;
  facts: SourceBoundFact[];
  sources: Source[];
  imageCandidates: ImageCandidate[];
  visualDirections: string[];
};

const extractMetaImage = (html: string) => {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]?.startsWith("http")) return match[1];
  }

  return null;
};

const discoverSourceImages = async (sources: Source[]) => {
  const results = await Promise.allSettled(
    sources.slice(0, 5).map(async source => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(source.url, {
          headers: { "User-Agent": "news-live-landings/1.0" },
          signal: controller.signal
        });
        if (!response.ok) return null;
        const html = await response.text();
        const imageUrl = extractMetaImage(html);
        if (!imageUrl) return null;
        return {
          url: imageUrl,
          title: source.title,
          credit: source.outlet,
          alt: `Image associated with ${source.title}`,
          sourceUrl: source.url
        } satisfies ImageCandidate;
      } finally {
        clearTimeout(timeout);
      }
    })
  );

  return results.flatMap(result => (result.status === "fulfilled" && result.value ? [result.value] : []));
};

const normalizeResearch = async (output: ResearchOutput): Promise<ResearchOutput> => {
  const fallbackSourceUrl = output.sources[0]?.url ?? "https://diegodella.ar/landings";
  const generatedImageCandidates = (output.imageCandidates ?? []).filter(
    image => image.url?.startsWith("http") && output.sources.some(source => source.url === image.sourceUrl)
  );
  const discoveredImageCandidates = await discoverSourceImages(output.sources);
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
Collect image candidates only when the image URL is directly associated with a returned source, such as a source article OpenGraph image or press image.
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
