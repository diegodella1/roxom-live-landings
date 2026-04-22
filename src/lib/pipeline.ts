import {
  createLanding,
  getLandingBySlug,
  listActiveLandings,
  markLandingCycle,
  recordLiveCycle,
  updateLandingContent,
  updateLandingStatus
} from "./db";
import { finalUrlForSlug } from "./config";
import { slugify } from "./slug";
import { runCritic } from "./agents/critic";
import { defaultStitchDesignSpec, runDesigner, runDesignerRevision } from "./agents/designer";
import { deltaHash, runLiveMonitor, runLiveUpdater } from "./agents/live";
import { runResearch } from "./agents/research";
import { runWriter, type WriterOutput } from "./agents/writer";
import type { LandingContent, LandingRecord } from "./types";

const retryableStatuses = new Set(["blocked", "cancelled", "failed"]);
const maxCriticRepairAttempts = 3;

const createOrRestartDraft = (input: { existing: LandingRecord | null; content: LandingContent; slug: string; topic: string }) => {
  const content = {
    ...input.content,
    slug: input.slug,
    topic: input.topic,
    status: "critic_review" as const
  };

  if (input.existing && retryableStatuses.has(input.existing.status)) {
    return updateLandingContent(input.existing.id, content, "critic_review");
  }

  return createLanding(content);
};

const safeBriefContent = (input: {
  base: LandingContent;
  writing: WriterOutput;
  slug: string;
  topic: string;
  reason: string;
}): LandingContent => {
  const timestamp = new Date().toISOString();
  const facts = input.base.summary
    ? [input.base.summary, ...input.writing.sections.map(section => section.body)]
    : input.writing.sections.map(section => section.body);
  const primarySource = input.base.sources[0];
  const primarySourceUrl = primarySource?.url ?? finalUrlForSlug(input.slug);

  return {
    ...input.base,
    slug: input.slug,
    topic: input.topic,
    headline: input.writing.headline || `Live brief: ${input.topic}`,
    subheadline: primarySource
      ? `A conservative sourced brief based on reporting from ${primarySource.outlet}.`
      : "A conservative sourced brief with live monitoring enabled.",
    summary:
      facts[0] ??
      `This page is tracking ${input.topic}. It will update only when verified source material passes the publishing guardrails.`,
    status: "live",
    lastUpdatedUtc: timestamp,
    sections: [
      {
        id: "what-is-reported",
        eyebrow: "Reported",
        title: "What is reported now",
        body: facts[0] ?? `The current brief tracks ${input.topic} using the listed sources.`,
        visualHint: "data",
        sourceUrls: [primarySourceUrl]
      },
      {
        id: "source-context",
        eyebrow: "Sources",
        title: "Where this stands",
        body:
          input.base.sources.length > 0
            ? `This brief uses ${input.base.sources.map(source => source.outlet).join(", ")} as its source base and avoids claims outside that reporting.`
            : "This brief is waiting for stronger source coverage before adding more detail.",
        visualHint: "quote",
        sourceUrls: input.base.sources.length > 0 ? input.base.sources.map(source => source.url) : [primarySourceUrl]
      },
      {
        id: "watch-next",
        eyebrow: "Watch Next",
        title: "What could change",
        body: "The live monitor will update this page when new verified facts materially change the story.",
        visualHint: "svg",
        sourceUrls: [primarySourceUrl]
      }
    ],
    quotes: [],
    dataPoints: [
      {
        label: "Sources",
        value: String(input.base.sources.length),
        context: "Count of sources attached to this conservative live brief.",
        sourceUrl: primarySourceUrl
      }
    ],
    designSpec: input.base.designSpec ?? defaultStitchDesignSpec(),
    updateHistory: [
      {
        timestampUtc: timestamp,
        materiality: "MINOR",
        summary: `Published as conservative safe brief after autonomous repair feedback: ${input.reason}`,
        sourceUrls: input.base.sources.map(source => source.url)
      },
      ...input.base.updateHistory
    ]
  };
};

export const startLiveLanding = async (topic: string) => {
  const slug = slugify(topic);
  const existing = getLandingBySlug(slug);
  if (existing && !retryableStatuses.has(existing.status)) return existing;

  const research = await runResearch(topic);
  const writing = await runWriter(research);
  const designed = await runDesigner(topic, research, writing);
  let draft;
  try {
    draft = createOrRestartDraft({ existing, content: designed, slug, topic });
  } catch (error) {
    if (String(error).includes("UNIQUE constraint failed")) {
      const landing = getLandingBySlug(slug);
      if (landing) return landing;
    }
    throw error;
  }
  let content = draft.content;
  let critic = await runCritic(content, draft.id);

  for (let attempt = 0; !critic.approved && critic.severity === "changes_requested" && attempt < maxCriticRepairAttempts; attempt += 1) {
    content = await runDesignerRevision(content, critic, research);
    critic = await runCritic(content, draft.id);
  }

  if (!critic.approved && critic.severity === "blocked") {
    return updateLandingContent(
      draft.id,
      {
        ...content,
        status: "blocked",
        updateHistory: [
          {
            timestampUtc: new Date().toISOString(),
            materiality: "BLOCKER",
            summary: critic.summary,
            sourceUrls: []
          },
          ...content.updateHistory
        ]
      },
      "blocked"
    );
  }

  if (!critic.approved) {
    const safeContent = safeBriefContent({ base: content, writing, slug, topic, reason: critic.summary });
    return updateLandingContent(draft.id, safeContent, "live");
  }

  return updateLandingContent(draft.id, { ...content, status: "live" }, "live");
};

export const runLiveCycleForLanding = async (slug: string) => {
  const landing = getLandingBySlug(slug);
  if (!landing) throw new Error(`Landing not found: ${slug}`);
  if (landing.status !== "live") return { landing, monitor: null, updated: false };

  const monitor = await runLiveMonitor(landing.content, landing.id);
  markLandingCycle(landing.id);

  if (monitor.materiality === "NO_MATERIAL_CHANGE" || monitor.materiality === "MINOR") {
    recordLiveCycle(landing.id, monitor.materiality, deltaHash(monitor), { approved: true, skipped: true });
    return { landing, monitor, updated: false };
  }

  if (monitor.materiality === "BLOCKER") {
    updateLandingStatus(landing.id, "blocked");
    recordLiveCycle(landing.id, monitor.materiality, deltaHash(monitor), { approved: false, blocked: true });
    return { landing: getLandingBySlug(slug) ?? landing, monitor, updated: false };
  }

  const updatedContent = await runLiveUpdater(landing.content, monitor, landing.id);
  const critic = await runCritic(updatedContent, landing.id);
  recordLiveCycle(landing.id, monitor.materiality, deltaHash(monitor), critic);

  if (!critic.approved) return { landing, monitor, updated: false, critic };

  const updatedLanding = updateLandingContent(landing.id, { ...updatedContent, status: "live" }, "live");
  return { landing: updatedLanding, monitor, updated: true, critic };
};

export const runAllLiveCycles = async () => {
  const active = listActiveLandings();
  const results = [];
  for (const landing of active) {
    results.push(await runLiveCycleForLanding(landing.slug));
  }
  return results;
};

export const publicFinalUrl = (slug: string) => finalUrlForSlug(slug);
