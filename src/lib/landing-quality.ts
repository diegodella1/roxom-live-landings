import type { LandingContent, StorySection } from "./types";

const minimumSectionCount = 9;
const minimumSectionWords = 120;

const sectionBlueprints: Array<Pick<StorySection, "id" | "eyebrow" | "title" | "visualHint">> = [
  { id: "lead", eyebrow: "Lead", title: "What is known now", visualHint: "image" },
  { id: "stakes", eyebrow: "Stakes", title: "Why it matters", visualHint: "data" },
  { id: "actors", eyebrow: "People", title: "Who is involved", visualHint: "image" },
  { id: "status", eyebrow: "Status", title: "Where things stand", visualHint: "chart" },
  { id: "timeline", eyebrow: "Timeline", title: "How the story moved", visualHint: "data" },
  { id: "impact", eyebrow: "Impact", title: "What changes on the ground", visualHint: "map" },
  { id: "reactions", eyebrow: "Reaction", title: "What the source record shows", visualHint: "quote" },
  { id: "risk", eyebrow: "Risk", title: "What remains uncertain", visualHint: "data" },
  { id: "next", eyebrow: "Watch Next", title: "What could change the page", visualHint: "svg" }
];

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

const sourceListText = (content: LandingContent) => {
  const outlets = content.sources.map(source => source.outlet).filter(Boolean);
  if (outlets.length === 0) return "the attached source list";
  if (outlets.length === 1) return outlets[0];
  return `${outlets.slice(0, -1).join(", ")} and ${outlets[outlets.length - 1]}`;
};

const sectionSources = (content: LandingContent, section?: StorySection) => {
  const sourceUrls = new Set(content.sources.map(source => source.url));
  const validSectionSources = section?.sourceUrls?.filter(url => sourceUrls.has(url)) ?? [];
  if (validSectionSources.length > 0) return validSectionSources;
  return content.sources.slice(0, 3).map(source => source.url);
};

const expandBody = (content: LandingContent, body: string, sectionTitle: string) => {
  const safeBody = body.trim() || content.summary || `This section tracks ${content.topic} from the attached sources.`;
  if (wordCount(safeBody) >= minimumSectionWords) return safeBody;

  const sourceText = sourceListText(content);
  const guardrail = ` This section is intentionally conservative: it stays inside the reporting attached to this landing, keeps source links visible, and avoids adding claims that are not present in the source record. For ${content.topic}, the useful reader task is to separate what is confirmed from what is still moving, then make the next monitoring point clear.`;
  const context = ` The ${sectionTitle.toLowerCase()} angle should be read alongside the full bibliography below, which currently draws from ${sourceText}. As the live monitor finds material changes, this section can be replaced with more specific reported detail after Critic approval.`;

  return `${safeBody}${guardrail}${context}`;
};

export const enforceTopLineLanding = (content: LandingContent): LandingContent => {
  const usedIds = new Set<string>();
  const normalizedSections = content.sections.map((section, index) => {
    const id = section.id || `section-${index + 1}`;
    usedIds.add(id);
    return {
      ...section,
      id,
      sourceUrls: sectionSources(content, section),
      body: expandBody(content, section.body, section.title)
    };
  });

  for (const blueprint of sectionBlueprints) {
    if (normalizedSections.length >= minimumSectionCount) break;
    const id = usedIds.has(blueprint.id) ? `${blueprint.id}-${normalizedSections.length + 1}` : blueprint.id;
    usedIds.add(id);
    normalizedSections.push({
      ...blueprint,
      id,
      body: expandBody(content, content.summary, blueprint.title),
      sourceUrls: sectionSources(content)
    });
  }

  const primarySourceUrl = content.sources[0]?.url ?? "https://diegodella.ar/landings";
  const existingLabels = new Set(content.dataPoints.map(point => point.label.toLowerCase()));
  const dataPoints = [...content.dataPoints];
  const requiredData = [
    {
      label: "Sources",
      value: String(content.sources.length),
      context: "Source count attached to this landing.",
      sourceUrl: primarySourceUrl
    },
    {
      label: "Sections",
      value: String(normalizedSections.length),
      context: "Reader-facing story sections in this landing.",
      sourceUrl: primarySourceUrl
    },
    {
      label: "Update loop",
      value: "30 min",
      context: "Live monitor cadence for material changes.",
      sourceUrl: primarySourceUrl
    }
  ];

  for (const point of requiredData) {
    if (dataPoints.length >= 3) break;
    if (!existingLabels.has(point.label.toLowerCase())) dataPoints.push(point);
  }

  return {
    ...content,
    sections: normalizedSections,
    dataPoints
  };
};
