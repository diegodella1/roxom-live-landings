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
- Layout must be a premium editorial one-page landing: no TV format, no carousel, no auto-scroll, no ticker motion.
- It must feel like top editorial quality: strong cover image, concise headline, asymmetric story grid, visible sources, and useful data/context.
- Choose the layout from the topic:
  - person-profile: one dominant person, founder, executive, politician, athlete, artist, or suspect. Use face/portrait imagery as the main experience.
  - event-brief: event, conflict, hearing, lawsuit, launch, accident, speech, policy decision, or breaking incident. Use scene/context imagery and timeline structure.
  - market-brief: price action, stocks, crypto, rates, commodities, earnings, treasury, ETF, or macro move. Use data-first hierarchy with chart visuals.
  - data-dashboard: multi-metric topic where numbers explain the story better than a scene.
  - visual-cover: default when none of the above dominates.
- Use a large photographic hero when imageCandidates has a verified image URL.
- If imageCandidates exists, include every useful imageCandidate as a VisualAsset with type "image", url, credit, and alt from imageCandidates.
- Use SVG only as a fallback or supporting visual, never as the only visual when a source-associated image exists.
- Create chart, map, timeline, bubble, surface, or comparison visuals when the sourced facts contain numbers, dates, geography, flows, prices, volumes, or actors.
- Mark sections with visualHint "chart", "map", "data", or "image" according to the strongest available visual evidence.
- Avoid the old neon TV/broadcast look.
- Keep hero text tight: headline plus 1-2 sentence subheadline. Put detail into sections.
- Use modular React-friendly regions: Hero, Source Rail, Story Grid, Data/Context, Update History.
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
      visuals: research.imageCandidates.length > 0
        ? research.imageCandidates.slice(0, 4).map(image => ({
            type: "image",
            title: image.title,
            url: image.url,
            credit: image.credit,
            alt: image.alt
          }) satisfies VisualAsset)
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
- Keep at least 5 sections when the source material supports it.
- Preserve source-associated image visuals from Research whenever imageCandidates are available.
- Use a premium editorial one-page layout. Do not use auto-scroll, carousels, ticker motion, or TV-slide language.
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
  motion: "subtle reveal only; no auto-scroll, marquee, carousel, or horizontal panning",
  notes: ["Avoid neon TV styling", "Prioritize source clarity", "Use one-page editorial sections"]
});
