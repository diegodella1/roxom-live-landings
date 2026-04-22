import { runJsonAgent } from "../openai";
import { slugify } from "../slug";
import type { CriticResult, LandingContent, VisualAsset } from "../types";
import { miamiDesignSystem } from "./prompts";
import type { ResearchOutput } from "./research";
import type { WriterOutput } from "./writer";

export const runDesigner = (topic: string, research: ResearchOutput, writing: WriterOutput) => {
  const slug = slugify(topic);
  return runJsonAgent<LandingContent>({
    agent: "designer",
    system: miamiDesignSystem,
    prompt: `
Create structured live news landing JSON. Do not generate React code.
Use this exact JSON shape:
{
  "slug": string,
  "topic": string,
  "headline": string,
  "subheadline": string,
  "summary": string,
  "status": "drafting",
  "lastUpdatedUtc": string,
  "sources": Source[],
  "visuals": VisualAsset[],
  "sections": StorySection[],
  "quotes": Quote[],
  "dataPoints": DataPoint[],
  "updateHistory": []
}
Make visuals renderable by reusable Next.js components. Use SVG visual directions if no real image URL is verified.
Topic: ${topic}
Research: ${JSON.stringify(research)}
Writing: ${JSON.stringify(writing)}
`,
    fallback: () => ({
      slug,
      topic,
      headline: writing.headline,
      subheadline: writing.subheadline,
      summary: writing.summary,
      status: "drafting",
      lastUpdatedUtc: new Date().toISOString(),
      sources: research.sources,
      visuals: [
        {
          type: "svg",
          title: research.visualDirections[0] ?? "Neon broadcast grid",
          credit: "Generated visual direction",
          alt: "Abstract Miami neon broadcast grid"
        } satisfies VisualAsset
      ],
      sections: writing.sections,
      quotes: writing.quotes,
      dataPoints: writing.dataPoints,
      updateHistory: []
    })
  });
};

export const runDesignerRevision = (content: LandingContent, critic: CriticResult, research: ResearchOutput) =>
  runJsonAgent<LandingContent>({
    agent: "designer",
    system: miamiDesignSystem,
    prompt: `
Revise this live news landing JSON so it can pass Critic without human intervention.
Keep the same JSON shape and slug. Return only the complete revised JSON.

Rules:
- Remove any factual claim that is not directly supported by the source list.
- Attribute allegations clearly as allegations or reported claims.
- Every quote and data point must include a real sourceUrl from the source list.
- If dates differ, distinguish event date from report date.
- Keep at least 3 sections and at least one renderable visual.
- Use safe, neutral wording. Do not overstate legal claims as fact.
- Set "status" to "critic_review".

Critic feedback:
${JSON.stringify(critic)}

Research:
${JSON.stringify(research)}

Current landing JSON:
${JSON.stringify(content)}
`,
    fallback: () => ({
      ...content,
      status: "critic_review",
      summary: content.sources.length > 0 ? content.summary : `This live brief tracks ${content.topic} with verified source requirements.`,
      quotes: content.quotes.filter(quote => content.sources.some(source => source.url === quote.sourceUrl)),
      dataPoints: content.dataPoints.filter(point => content.sources.some(source => source.url === point.sourceUrl))
    })
  });
