import { runJsonAgent } from "../openai";
import type { StorySection } from "../types";
import { editorialSystem } from "./prompts";
import type { ResearchOutput } from "./research";

export type WriterOutput = {
  headline: string;
  subheadline: string;
  summary: string;
  sections: StorySection[];
  quotes: Array<{ quote: string; attribution: string; sourceUrl: string }>;
  dataPoints: Array<{ label: string; value: string; context: string; sourceUrl: string }>;
};

export const runWriter = (research: ResearchOutput) =>
  runJsonAgent<WriterOutput>({
    agent: "writer",
    system: editorialSystem,
    prompt: `
Write structured landing content from this research package.
Every factual sentence must be supported by the source-bound facts in Research.
Every section must include sourceUrls from the source list.
Every quote and data point must include sourceUrl from the source list.
Do not invent quotes. If exact quotation text is not present in the research, return an empty quotes array.
Return JSON:
{
  "headline": string,
  "subheadline": string,
  "summary": string,
  "sections": [{"id": string, "eyebrow": string, "title": string, "body": string, "visualHint": "image"|"chart"|"quote"|"data"|"svg", "sourceUrls": string[]}],
  "quotes": [{"quote": string, "attribution": string, "sourceUrl": string}],
  "dataPoints": [{"label": string, "value": string, "context": string, "sourceUrl": string}]
}
Research:
${JSON.stringify(research)}
`,
    fallback: () => ({
      headline: `Live brief: ${research.topic}`,
      subheadline: "A sourced live news brief tracks verified facts and material updates.",
      summary: research.facts.map(fact => fact.claim).join(" "),
      sections: [
        {
          id: "live-brief",
          eyebrow: "Live Brief",
          title: "What is reported",
          body: research.facts[0]?.claim ?? `The live news pipeline is monitoring ${research.topic}.`,
          visualHint: "svg",
          sourceUrls: [research.facts[0]?.sourceUrl ?? research.sources[0]?.url ?? "https://diegodella.ar/landings"]
        },
        {
          id: "source-context",
          eyebrow: "Context",
          title: "Source context",
          body: research.facts[1]?.claim ?? "The page will add context only when it is supported by attached sources.",
          visualHint: "data",
          sourceUrls: [research.facts[1]?.sourceUrl ?? research.sources[0]?.url ?? "https://diegodella.ar/landings"]
        },
        {
          id: "watch-next",
          eyebrow: "Watch Next",
          title: "What could change",
          body: "The live monitor will update this page when new verified facts matter.",
          visualHint: "quote",
          sourceUrls: [research.sources[0]?.url ?? "https://diegodella.ar/landings"]
        }
      ],
      quotes: [],
      dataPoints: [
        {
          label: "Sources",
          value: String(research.sources.length),
          context: "Credible sources attached to this live landing.",
          sourceUrl: research.sources[0]?.url ?? "https://diegodella.ar/landings"
        }
      ]
    })
  });
