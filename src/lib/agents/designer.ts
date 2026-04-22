import { runJsonAgent } from "../openai";
import { slugify } from "../slug";
import type { CriticResult, ImageCandidate, LandingContent, LandingDesignSpec, VisualAsset } from "../types";
import { stitchDesignSystem } from "./prompts";
import type { ResearchOutput } from "./research";
import type { WriterOutput } from "./writer";

const normalizeLandingDesign = (content: LandingContent, fallback: LandingDesignSpec): LandingContent => {
  const sourceUrls = content.sources.map(source => source.url);
  const fallbackSourceUrl = sourceUrls[0] ?? "https://diegodella.ar/landings";
  return {
    ...content,
    sections: content.sections.map(section => {
      const validSourceUrls = section.sourceUrls?.filter(sourceUrl => sourceUrls.includes(sourceUrl)) ?? [];
      return {
        ...section,
        sourceUrls: validSourceUrls.length > 0 ? validSourceUrls : [fallbackSourceUrl]
      };
    }),
    quotes: content.quotes.filter(quote => sourceUrls.includes(quote.sourceUrl)),
    dataPoints: content.dataPoints.map(point => ({
      ...point,
      sourceUrl: sourceUrls.includes(point.sourceUrl) ? point.sourceUrl : fallbackSourceUrl
    })),
    designSpec: content.designSpec ?? fallback
  };
};

const ensurePrimaryImage = (content: LandingContent, image?: ImageCandidate) => {
  if (!image || content.visuals.some(visual => visual.type === "image" && visual.url)) return content;
  return {
    ...content,
    visuals: [
      {
        type: "image" as const,
        title: image.title,
        url: image.url,
        credit: image.credit,
        alt: image.alt
      },
      ...content.visuals
    ]
  };
};

export const runDesigner = async (topic: string, research: ResearchOutput, writing: WriterOutput) => {
  const slug = slugify(topic);
  const fallbackDesign = defaultStitchDesignSpec();
  const primaryImage = research.imageCandidates[0];
  const content = await runJsonAgent<LandingContent>({
    agent: "designer",
    system: stitchDesignSystem,
    prompt: `
Create structured live news landing JSON from a Stitch-style design plan. Do not generate React code.
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
  "sections": StorySection[] with sourceUrls,
  "quotes": Quote[],
  "dataPoints": DataPoint[],
  "designSpec": LandingDesignSpec,
  "updateHistory": []
}
Stitch design requirements:
- Layout must be clean, news-agnostic, highly visual, and source-forward.
- Use a large photographic/visual hero when imageCandidates has a verified image URL.
- If imageCandidates exists, include at least one VisualAsset with type "image", url, credit, and alt from imageCandidates.
- Use SVG only as a fallback or supporting visual, never as the only visual when a source-associated image exists.
- Create chart, map, timeline, bubble, surface, or comparison visuals when the sourced facts contain numbers, dates, geography, flows, prices, volumes, or actors.
- Mark sections with visualHint "chart", "map", "data", or "image" according to the strongest available visual evidence.
- Avoid the old neon TV/broadcast look.
- Keep text over imagery to 2-3 lines where possible.
- Use modular React-friendly regions: Hero, Source Rail, Story Frames, Data/Context, Update History.
- Do not add any factual claim not present in Writing or Research.
- Preserve sourceUrls on every section.
Images: ${JSON.stringify(research.imageCandidates)}
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
      visuals: primaryImage
        ? [
            {
              type: "image",
              title: primaryImage.title,
              url: primaryImage.url,
              credit: primaryImage.credit,
              alt: primaryImage.alt
            } satisfies VisualAsset
          ]
        : [
            {
              type: "svg",
              title: research.visualDirections[0] ?? "Editorial source-backed visual",
              credit: "Generated visual direction",
              alt: "Abstract editorial news visual"
            } satisfies VisualAsset
          ],
      sections: writing.sections,
      quotes: writing.quotes,
      dataPoints: writing.dataPoints,
      designSpec: fallbackDesign,
      updateHistory: []
    })
  });
  return ensurePrimaryImage(normalizeLandingDesign(content, fallbackDesign), primaryImage);
};

export const runDesignerRevision = async (content: LandingContent, critic: CriticResult, research: ResearchOutput) =>
  normalizeLandingDesign(await runJsonAgent<LandingContent>({
    agent: "designer",
    system: stitchDesignSystem,
    prompt: `
Revise this live news landing JSON so it can pass Critic without human intervention.
Keep the same JSON shape and slug. Return only the complete revised JSON.

Rules:
- Remove any factual claim that is not directly supported by the source list.
- Attribute allegations clearly as allegations or reported claims.
- Every quote and data point must include a real sourceUrl from the source list.
- Every section must include sourceUrls from the source list.
- If dates differ, distinguish event date from report date.
- Keep at least 3 sections and at least one renderable visual.
- Use safe, neutral wording. Do not overstate legal claims as fact.
- Preserve or improve designSpec using the Stitch design system.
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
      designSpec: content.designSpec ?? defaultStitchDesignSpec(),
      summary: content.sources.length > 0 ? content.summary : `This live brief tracks ${content.topic} with verified source requirements.`,
      quotes: content.quotes.filter(quote => content.sources.some(source => source.url === quote.sourceUrl)),
      dataPoints: content.dataPoints.filter(point => content.sources.some(source => source.url === point.sourceUrl))
    })
  }), content.designSpec ?? defaultStitchDesignSpec());

export const defaultStitchDesignSpec = (): LandingDesignSpec => ({
  source: "stitch",
  styleName: "source-forward editorial visual",
  layout: "visual-cover",
  mood: "clear, premium, restrained, news-agnostic",
  palette: {
    background: "#0f1115",
    text: "#f5f7fb",
    accent: "#4da3ff",
    muted: "#9aa4b2"
  },
  heroTreatment: "large visual background with concise headline and source-aware metadata",
  motion: "subtle scroll reveal and horizontal story frame motion only when useful",
  notes: ["Avoid neon TV styling", "Prioritize source clarity", "Use modular React sections"]
});
