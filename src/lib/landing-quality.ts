import type { LandingContent, StorySection } from "./types";

const minimumSectionCount = 6;
const minimumSectionWords = 55;

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

const sectionSources = (content: LandingContent, section?: StorySection) => {
  const sourceUrls = new Set(content.sources.map(source => source.url));
  const validSectionSources = section?.sourceUrls?.filter(url => sourceUrls.has(url)) ?? [];
  if (validSectionSources.length > 0) return validSectionSources;
  return content.sources.slice(0, 3).map(source => source.url);
};

const cleanReaderFacingCopy = (text: string) => text
  .replace(/\s+/g, " ")
  .replace(/This section is intentionally conservative:[^.]*\./gi, "")
  .replace(/For [^.]*, the useful reader task is[^.]*\./gi, "")
  .replace(/The [^.]* angle should be read alongside the full bibliography below, which currently draws from[^.]*\./gi, "")
  .replace(/As the live monitor finds material changes, this section can be replaced[^.]*\./gi, "")
  .replace(/Critic approval/gi, "editorial review")
  .trim();

const expandBody = (content: LandingContent, body: string, sectionTitle: string) => {
  const safeBody = cleanReaderFacingCopy(body.trim() || content.summary || `This section tracks ${content.topic}.`);
  if (wordCount(safeBody) >= minimumSectionWords) return safeBody;
  return safeBody;
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

  return {
    ...content,
    sections: normalizedSections,
    dataPoints: content.dataPoints
  };
};
