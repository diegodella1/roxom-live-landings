import { listLandings, updateLandingContent } from "./db";

const retryableRecoveryStatuses = new Set(["drafting", "critic_review"]);
const staleRunMinutes = 12;
const recoveryThrottleMs = 60 * 1000;

let lastRecoveryAt = 0;

const isStale = (updatedAt: string) => {
  const updatedMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedMs)) return false;
  return Date.now() - updatedMs > staleRunMinutes * 60 * 1000;
};

export const recoverInterruptedRuns = () => {
  const nowMs = Date.now();
  if (nowMs - lastRecoveryAt < recoveryThrottleMs) return [];
  lastRecoveryAt = nowMs;

  const recovered: string[] = [];
  const candidates = listLandings(200).filter(landing =>
    retryableRecoveryStatuses.has(landing.status) && isStale(landing.updatedAt)
  );

  for (const landing of candidates) {
    updateLandingContent(
      landing.id,
      {
        ...landing.content,
        status: "failed",
        updateHistory: [
          {
            timestampUtc: new Date().toISOString(),
            materiality: "BLOCKER",
            summary: "Marked failed after an interrupted run left the landing unfinished during drafting or critic review.",
            sourceUrls: landing.content.sources.map(source => source.url)
          },
          ...landing.content.updateHistory
        ]
      },
      "failed"
    );
    recovered.push(landing.slug);
  }

  return recovered;
};
