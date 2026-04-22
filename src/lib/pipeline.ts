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
import { runDesigner } from "./agents/designer";
import { deltaHash, runLiveMonitor, runLiveUpdater } from "./agents/live";
import { runResearch } from "./agents/research";
import { runWriter } from "./agents/writer";

export const startLiveLanding = async (topic: string) => {
  const slug = slugify(topic);
  const existing = getLandingBySlug(slug);
  if (existing) return existing;

  const research = await runResearch(topic);
  const writing = await runWriter(research);
  const designed = await runDesigner(topic, research, writing);
  let draft;
  try {
    draft = createLanding({ ...designed, slug, topic, status: "critic_review" });
  } catch (error) {
    if (String(error).includes("UNIQUE constraint failed")) {
      const landing = getLandingBySlug(slug);
      if (landing) return landing;
    }
    throw error;
  }
  const critic = await runCritic(draft.content, draft.id);

  if (!critic.approved) {
    updateLandingStatus(draft.id, "blocked");
    return {
      ...draft,
      status: "blocked" as const,
      content: {
        ...draft.content,
        status: "blocked" as const,
        updateHistory: [
          {
            timestampUtc: new Date().toISOString(),
            materiality: "BLOCKER" as const,
            summary: critic.summary,
            sourceUrls: []
          },
          ...draft.content.updateHistory
        ]
      }
    };
  }

  return updateLandingContent(draft.id, { ...draft.content, status: "live" }, "live");
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
