import type { CriticResult, LandingContent, LiveMonitorResult, Source } from "../types";
import { slugify } from "../slug";

const now = () => new Date().toISOString();

export const fallbackSources = (topic: string): Source[] => [
  {
    title: `Primary coverage for ${topic}`,
    outlet: "Reuters",
    url: "https://www.reuters.com/",
    credibility: "tier1"
  },
  {
    title: `Market and context coverage for ${topic}`,
    outlet: "Bloomberg",
    url: "https://www.bloomberg.com/",
    credibility: "tier1"
  }
];

export const fallbackLanding = (topic: string, slug = slugify(topic)): LandingContent => {
  const sources = fallbackSources(topic);
  const primarySourceUrl = sources[0].url;
  return {
    slug,
    topic,
    headline: `Live brief: ${topic}`,
    subheadline: "This live brief tracks the story with verified sources, context, and live updates.",
    summary: `A live news landing for ${topic}, prepared with sourced context and a 30-minute update loop.`,
    status: "drafting",
    lastUpdatedUtc: now(),
    sources,
  visuals: [
    {
      type: "svg",
      title: "Editorial source-backed visual",
      credit: "Generated visual system",
      alt: "Abstract editorial news visual"
    }
  ],
  sections: [
    {
      id: "what-happened",
      eyebrow: "Live Brief",
      title: "What happened",
      body: `The pipeline is preparing a sourced live brief for ${topic}. Production mode will replace this fallback with fresh web-backed research.`,
      visualHint: "svg",
      sourceUrls: [primarySourceUrl]
    },
    {
      id: "why-it-matters",
      eyebrow: "Impact",
      title: "Why it matters now",
      body: "The story is being monitored for market impact, official statements, and material changes that deserve a page update.",
      visualHint: "data",
      sourceUrls: [primarySourceUrl]
    },
    {
      id: "what-next",
      eyebrow: "Next Watch",
      title: "What changes the page",
      body: "The live loop updates only when a verified important or critical delta passes Critic approval.",
      visualHint: "quote",
      sourceUrls: [primarySourceUrl]
    }
  ],
  quotes: [],
  dataPoints: [
    {
      label: "Update cycle",
      value: "30 min",
      context: "Live monitor checks active landings every configured cycle.",
      sourceUrl: primarySourceUrl
    },
    {
      label: "Approval gate",
      value: "Critic",
      context: "Every first publish and material update requires Critic approval.",
      sourceUrl: primarySourceUrl
    }
  ],
  designSpec: {
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
  },
  updateHistory: []
  };
};

export const fallbackCriticApproved = (): CriticResult => ({
  approved: true,
  severity: "approved",
  issues: [],
  summary: "Approved by local validation fallback."
});

export const fallbackNoMaterialChange = (): LiveMonitorResult => ({
  materiality: "NO_MATERIAL_CHANGE",
  summary: "No material change detected by fallback monitor.",
  delta: "",
  sourceUrls: []
});
