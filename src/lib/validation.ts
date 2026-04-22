import type { CriticResult, LandingContent } from "./types";

export const validateLandingContent = (content: LandingContent): CriticResult => {
  const issues: string[] = [];

  if (!content.headline || content.headline.length < 12) issues.push("Headline is missing or too weak.");
  if (!content.subheadline) issues.push("Subheadline is missing.");
  if (content.sources.length < 2) issues.push("At least two cited sources are required.");
  if (content.sections.length < 3) issues.push("At least three story sections are required.");
  if (!content.visuals.length) issues.push("At least one visual asset or SVG direction is required.");

  for (const source of content.sources) {
    if (!source.url.startsWith("http")) issues.push(`Invalid source URL: ${source.url}`);
    if (source.credibility === "unknown") issues.push(`Unknown source credibility for ${source.outlet}.`);
  }

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
