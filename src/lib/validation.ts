import type { CriticResult, LandingContent } from "./types";

export const validateLandingContent = (content: LandingContent): CriticResult => {
  const issues: string[] = [];
  const sourceUrls = new Set(content.sources.map(source => source.url));

  if (!content.headline || content.headline.length < 12) issues.push("Headline is missing or too weak.");
  if (!content.subheadline) issues.push("Subheadline is missing.");
  if (content.sources.length < 3) issues.push("At least three cited sources are required.");
  if (content.sections.length < 7) issues.push("At least seven story sections are required for a useful editorial feature.");
  if (!content.visuals.length) issues.push("At least one visual asset or SVG direction is required.");
  if (!content.visuals.some(visual => visual.type === "image" && visual.url?.startsWith("http"))) {
    issues.push("At least one sourced image URL is required for the landing hero when available.");
  }
  if (content.dataPoints.length < 3) issues.push("At least three sourced data/context points are required.");

  for (const source of content.sources) {
    if (!source.url.startsWith("http")) issues.push(`Invalid source URL: ${source.url}`);
    if (source.credibility === "unknown") issues.push(`Unknown source credibility for ${source.outlet}.`);
  }

  for (const section of content.sections) {
    if (!section.sourceUrls?.length) {
      issues.push(`Missing source URLs for section ${section.id}.`);
      continue;
    }
    if (section.body.split(/\s+/).filter(Boolean).length < 85) {
      issues.push(`Section ${section.id} is too thin; expand it with sourced context.`);
    }

    for (const sourceUrl of section.sourceUrls) {
      if (!sourceUrls.has(sourceUrl)) issues.push(`Section ${section.id} cites a source URL that is not attached to the landing.`);
    }
  }

  for (const quote of content.quotes) {
    if (!sourceUrls.has(quote.sourceUrl)) issues.push(`Quote cites a source URL that is not attached to the landing: ${quote.sourceUrl}`);
  }

  for (const point of content.dataPoints) {
    if (!sourceUrls.has(point.sourceUrl)) issues.push(`Data point cites a source URL that is not attached to the landing: ${point.sourceUrl}`);
  }

  if (content.designSpec?.source !== "stitch") issues.push("Landing is missing a Stitch design specification.");

  const approved = issues.length === 0;
  return {
    approved,
    severity: approved ? "approved" : "changes_requested",
    issues,
    summary: approved
      ? "Approved for direct publishing."
      : `Changes requested before publishing: ${issues.join(" ")}`
  };
};
