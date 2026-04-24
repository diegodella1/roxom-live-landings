import { runJsonAgent } from "../openai";
import { enforceTopLineLanding } from "../landing-quality";
import { slugify } from "../slug";
import type { CriticResult, ImageCandidate, LandingContent, LandingDesignSpec, VisualAsset } from "../types";
import type { ResearchOutput } from "./research";
import type { WriterOutput } from "./writer";
import { loadClaudeAgentPrompt } from "../claude-prompts";

const sanitizeDesignSpec = (
  designSpec: LandingContent["designSpec"] | undefined,
  fallback: LandingDesignSpec
): LandingDesignSpec => {
  const palette = designSpec?.palette ?? fallback.palette;
  const notes = Array.isArray(designSpec?.notes)
    ? designSpec.notes.map(note => note.trim()).filter(Boolean)
    : fallback.notes;

  return {
    source: "stitch",
    styleName: designSpec?.styleName?.trim() || fallback.styleName,
    layout: designSpec?.layout ?? fallback.layout,
    mood: designSpec?.mood?.trim() || fallback.mood,
    palette: {
      background: palette.background?.trim() || fallback.palette.background,
      text: palette.text?.trim() || fallback.palette.text,
      accent: palette.accent?.trim() || fallback.palette.accent,
      muted: palette.muted?.trim() || fallback.palette.muted
    },
    heroTreatment: designSpec?.heroTreatment?.trim() || fallback.heroTreatment,
    motion: designSpec?.motion?.trim() || fallback.motion,
    notes: notes.length > 0 ? notes : fallback.notes
  };
};

const normalizeLandingDesign = (content: LandingContent, fallback: LandingDesignSpec): LandingContent => {
  const sourceUrls = content.sources.map(source => source.url);
  const fallbackSourceUrl = sourceUrls[0] ?? "https://diegodella.ar/landings";
  return enforceTopLineLanding({
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
    designSpec: sanitizeDesignSpec(content.designSpec, fallback)
  });
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
        alt: image.alt,
        relevance: image.relevance,
        relevanceReason: image.relevanceReason
      },
      ...content.visuals
    ]
  };
};

const ensureStoryImageCoverage = (content: LandingContent, images: ImageCandidate[]) => {
  if (images.length === 0) return content;

  const existingUrls = new Set(
    content.visuals
      .filter((visual): visual is VisualAsset & { url: string } => visual.type === "image" && Boolean(visual.url))
      .map(visual => visual.url)
  );
  const targetCount = Math.min(images.length, 8);
  if (existingUrls.size >= targetCount) return content;

  const appendedVisuals = images
    .filter(image => !existingUrls.has(image.url))
    .slice(0, targetCount - existingUrls.size)
    .map(image => ({
      type: "image",
      title: image.title,
      url: image.url,
      credit: image.credit,
      alt: image.alt,
      relevance: image.relevance,
      relevanceReason: image.relevanceReason
    }) satisfies VisualAsset);

  if (appendedVisuals.length === 0) return content;
  return {
    ...content,
    visuals: [...content.visuals, ...appendedVisuals]
  };
};

export const runDesigner = async (topic: string, research: ResearchOutput, writing: WriterOutput) => {
  const slug = slugify(topic);
  const fallbackDesign = defaultStitchDesignSpec();
  const primaryImage = research.imageCandidates[0];
  const systemPrompt = await loadClaudeAgentPrompt("designer");
  const content = await runJsonAgent<LandingContent>({
    agent: "designer",
    system: systemPrompt,
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
- The designSpec object is mandatory and must be complete. Do not omit fields or return a partial object.
- Return designSpec exactly with:
  - source: "stitch"
  - styleName: short descriptive string
  - layout: one of "visual-cover" | "person-profile" | "event-brief" | "timeline" | "data-dashboard" | "market-brief" | "competition-brief" | "election-brief"
  - mood: short descriptive string
  - palette: object with background, text, accent, muted
  - heroTreatment: string
  - motion: string
  - notes: string[] with at least 2 concrete implementation notes
- Preserve the story's freshest angle in the first viewport. The hero, summary, and first article section must make the current development understandable without scrolling.
- Layout must follow the Roxom live intelligence system: alert ticker, fixed masthead, command rail on desktop, dominant image hero, stacked hero metric cards, live-intel side column, strategic briefing band, long article body, inline imagery, timeline when useful, pull quotes, data/stat section when useful, reactions/source cards, gallery, and footer sources.
- Do not produce a card-grid landing or compact dossier. The main experience is a readable long-form article with strong narrative pacing and inline visuals.
- Use the signal palette, not decorative branding:
  - signal blue for active channels and command surfaces
  - flow green for continuity/stability
  - alert red for disruption, spikes, or breaking states
  - hot pink/neon purple only when they support live-broadcast urgency or structural layering
- It must feel like a Vice-style news feature: immersive, image-led, edgy but credible, human and specific, with sources visible but not dominating the reading experience.
- Never expose pipeline/process language in reader-facing content or layout. Do not foreground section counts, source counts, repair logic, bibliography talk, monitoring cadence, or "conservative brief" framing in the hero, summary, sections, data cards, or update history.
- The page should feel like a field dispatch with conviction, not a neutral dashboard. Make room for strong thesis lines, hard stakes, and state-power or monetary-pressure framing when the writing supports it.
- The page should feel like a live intelligence feed. Information should appear to compete for attention in a controlled way, like a financial terminal or broadcast overlay, not like a static feature template.
- Favor crisp hierarchy over long soft intros: one sharp thesis in the hero, one strong top-line block, then story modules that escalate the argument. The first viewport should feel like a newsroom command dashboard, not a magazine splash page with a sidebar bolted on.
- Build topic-specific journalism into the structure, not generic blocks:
  - competition/rivalry pages need competitors, status/standings/result, stakes, momentum shifts, quotes/reactions, and next milestone.
  - election/vote pages need results, vote share/seats/delegates, winners/losers, turnout or reporting status, challenges, party statements, and next procedural step.
  - market/crypto/economy pages need current levels, move size, catalysts, comparison, flows/volume when sourced, winners/losers, reactions, and next catalyst.
  - person pages need current relevance first, then biography/context, allies/critics, controversies/achievements, quotes, and what changes next.
  - event/crisis pages need timeline, geography, affected parties, impact, official statements, disputed claims, and what happens next.
- Choose the layout from the topic:
  - person-profile: one dominant person, founder, executive, politician, athlete, artist, or suspect. Use face/portrait imagery as the main experience.
  - event-brief: event, conflict, hearing, lawsuit, launch, accident, speech, policy decision, or breaking incident. Use scene/context imagery and timeline structure.
  - market-brief: price action, stocks, crypto, rates, commodities, earnings, treasury, ETF, or macro move. Use data-first hierarchy with chart visuals.
  - data-dashboard: multi-metric topic where numbers explain the story better than a scene.
  - competition-brief: sport, contest, tournament, race, awards, legal trial, or company/product rivalry where comparative status matters.
  - election-brief: election, referendum, vote, primary, runoff, legislative count, or leadership contest where results/outcomes matter.
  - visual-cover: default when none of the above dominates.
- The format must complement the nature of the story. Do not force every story into the same rhythm.
- Every requested item must produce a compact top-line landing with clear sections. The minimum reader contract is: lead, stakes, actors/entities, status or result, evidence/data or impact, uncertainty or next watch, and bottom source bibliography.
- Use a factual timeline only when chronology helps the reader understand the story. For market stories, use signals/data; for competitions, use status/stakes; for elections, use results/outcomes; for people, use profile timeline.
- Use a large photographic hero when imageCandidates has a verified image URL.
- If imageCandidates exists, include story-relevant imageCandidates as VisualAsset objects with type "image", url, credit, alt, relevance, and relevanceReason from imageCandidates.
- Use more of the verified photo pool when it exists. If there are 6 or more relevant imageCandidates, spend them across hero, inline article blocks, and the gallery instead of collapsing the page to one hero image.
- The layout should not flatten into repeated equal cards. Use one dominant hero, one compact live-intel column, one strong strategic briefing block, and then wider readable article sections.
- Article columns must stay readable. Avoid thin body columns or over-fragmenting the story into too many narrow panels.
- When the story supports it, give the hero two top-line metric cards sourced from real dataPoints so the first screen carries both narrative and hard numbers.
- Signal modules should feel reactive. Use timestamps, source labels, update cues, or confidence/reliability markers where they help scanning.
- Images must be directly related to the news, named people, named places, named institutions, or the exact context. Do not use decorative stock imagery when a more relevant image exists.
- Use SVG only as a fallback or supporting visual, never as the only visual when a source-associated image exists.
- Create chart, map, timeline, bubble, surface, or comparison visuals only when they map to specific sourced facts/dataPoints. A chart without sourced values is not allowed.
- Mark sections with visualHint "chart", "map", "data", or "image" according to the strongest available visual evidence.
- Use the retro-futurist broadcast look with restraint: neon glass, strong safe areas, source clarity, and no decorative clutter.
- Keep hero text tight: headline plus 1-2 sentence subheadline. Put detail into sections.
- Use modular React-friendly regions: Hero, Article, Timeline, Quotes, Data/Impact, Reactions, Gallery, Footer Sources.
- The landing must end with a complete source bibliography. Inline source tags are required, but the full source list belongs at the bottom.
- Do not add any factual claim not present in Writing or Research.
- Preserve sourceUrls on every section.
First-pass quality gate before returning:
- Pretend Critic will review the JSON next. Fix obvious failures before output.
- Headline, subheadline, and summary must make the story understandable without scrolling.
- The section order must answer, in order, what happened now, why it matters, who is involved, current status/result, evidence/data, reactions, uncertainty, and what happens next.
- Aim for 6-8 sections. Do not inflate the page beyond that unless the story is genuinely complex and each extra section adds new information.
- The top-line section map must have meaningful eyebrows, not repeated generic labels.
- Prefer one concise explainer/data band, not multiple repeated dashboard bands that restate the same evidence.
- If the page already has a hero, top-line block, and article body, do not add extra modules that merely summarize the same points again.
- Reader-facing prose must stay story-first. If a sentence is mainly about sourcing mechanics, page workflow, or editorial guardrails, rewrite it into a factual story sentence or remove it.
- If the writing surfaces freedom, sovereignty, sanctions, payment rails, energy choke points, fiscal stress, or bitcoin-relevant monetary fragility, reflect that in the hierarchy and cards instead of burying it in the lower sections.
- Visuals must be story-relevant. If no real image is available, include a deliberate SVG/chart/map fallback visual direction instead of pretending a decorative image exists.
- DesignSpec must match the retro-futurist broadcast system: hot pink, neon purple, bright cyan, glass restraint, strong source clarity.
- Data points must be useful as top-line cards and must cite attached sources.
- The output should be near perfect before Critic sees it: no generic filler, no decorative visuals, no missing bibliography, no unsupported claims, no thin opening.
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
        ? research.imageCandidates.slice(0, 8).map(image => ({
            type: "image",
            title: image.title,
            url: image.url,
            credit: image.credit,
            alt: image.alt,
            relevance: image.relevance,
            relevanceReason: image.relevanceReason
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
  return ensureStoryImageCoverage(ensurePrimaryImage(normalizeLandingDesign(content, fallbackDesign), primaryImage), research.imageCandidates);
};

export const runDesignerRevision = async (content: LandingContent, critic: CriticResult, research: ResearchOutput) => {
  const systemPrompt = await loadClaudeAgentPrompt("designer");
  return normalizeLandingDesign(await runJsonAgent<LandingContent>({
    agent: "designer",
    system: systemPrompt,
    prompt: `
Revise this live news landing JSON so it can pass Critic and still feel like a polished top-line news landing.
Keep the same JSON shape and slug. Return only the complete revised JSON.

Rules:
- Remove any factual claim that is not directly supported by the source list.
- Attribute allegations clearly as allegations or reported claims.
- Every quote and data point must include a real sourceUrl from the source list.
- Every section must include sourceUrls from the source list.
- If dates differ, distinguish event date from report date.
- Keep at least 9 substantial sections. If a section is thin, expand it only with already sourced facts, source-context framing, or clearly marked uncertainty.
- Preserve source-associated image visuals from Research whenever imageCandidates are available.
- If Research provides multiple strong imageCandidates, preserve and use enough of them to keep the landing visually alive across the article, not just the hero.
- Use the retro-futurist broadcast look with restraint: strong hero, top-line story map, neon glass accents, clear section hierarchy, and source clarity.
- Improve beauty and readability while fixing Critic issues. Better section titles, sharper summaries, stronger visual hints, and tighter data cards are valid repair work.
- Keep or add topic-specific reporting depth: competitors/status/results for competitions, results/outcomes for elections, quotes from relevant parties when exact source text exists, and full source bibliography at the end.
- Use safe, neutral wording. Do not overstate legal claims as fact.
- Preserve or improve designSpec using the Stitch design system.
- If Critic mentions designSpec, replace the entire designSpec object with a complete valid Stitch spec instead of tweaking one field.
- The revised designSpec must include source, styleName, layout, mood, palette.background, palette.text, palette.accent, palette.muted, heroTreatment, motion, and notes.
- Every Critic issue must be addressed directly. If a section id is named in feedback, fix that exact section. If a count is named, meet or exceed the count.
- Set "status" to "critic_review".
- After fixing the named issues, run one final full-page pass for top-line clarity, section completeness, source support, visual relevance, and first-viewport quality so a second repair loop is unlikely.
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
};

export const defaultStitchDesignSpec = (): LandingDesignSpec => ({
  source: "stitch",
  styleName: "source-forward editorial visual",
  layout: "visual-cover",
  mood: "clear, premium, restrained, news-agnostic",
  palette: {
    background: "#060707",
    text: "#ffffff",
    accent: "#ffb3b5",
    muted: "rgba(255,255,255,0.60)"
  },
  heroTreatment: "full-bleed photographic hero with dark gradient, live badge, topic tags, concise headline, and top-line story map",
  motion: "subtle reveal only; no auto-scroll, marquee, carousel, or horizontal panning",
  notes: ["Use retro-futurist broadcast newsroom style", "Prioritize source clarity", "Use article-first editorial sections"]
});
