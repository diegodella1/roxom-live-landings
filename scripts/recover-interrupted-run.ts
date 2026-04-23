import { env } from "../src/lib/config";
import { startLiveLanding } from "../src/lib/pipeline";
import { postSlackMessage } from "../src/lib/slack";

const formatStage = (topic: string, stage: string, detail?: string) =>
  `STAGE | topic=${topic} | stage=${stage}${detail ? ` | detail=${detail.slice(0, 500)}` : ""}`;

const formatFinal = (landing: { topic: string; slug: string; status: string; finalUrl: string; content: { updateHistory: Array<{ materiality: string; summary: string }> } }) => {
  if (landing.status === "live") {
    return `FINAL URL READY | topic=${landing.topic} | final_url=${landing.finalUrl} | index_url=${env.landingsIndexUrl}`;
  }

  if (landing.status === "blocked") {
    const blocker = landing.content.updateHistory.find(update => update.materiality === "BLOCKER");
    return `BLOCKED | topic=${landing.topic} | slug=${landing.slug} | status=${landing.status}${blocker?.summary ? ` | reason=${blocker.summary.slice(0, 700)}` : ""}`;
  }

  return `IN PROGRESS | topic=${landing.topic} | slug=${landing.slug} | status=${landing.status}`;
};

async function main() {
  const [topic, channel, threadTs] = process.argv.slice(2);
  if (!topic || !channel || !threadTs) {
    throw new Error("Usage: node recover-interrupted-run.js <topic> <channel> <threadTs>");
  }

  await postSlackMessage({
    channel,
    threadTs,
    text: `RECOVERY | topic=${topic} | detail=Resuming interrupted run after restart.`
  });

  const landing = await startLiveLanding(topic, (stage, detail) =>
    postSlackMessage({
      channel,
      threadTs,
      text: formatStage(topic, stage, detail)
    })
  );

  await postSlackMessage({
    channel,
    threadTs,
    text: formatFinal(landing)
  });
}

void main().catch(async error => {
  const [topic, channel, threadTs] = process.argv.slice(2);
  if (channel && threadTs) {
    await postSlackMessage({
      channel,
      threadTs,
      text: `BLOCKER | stage=recovery | action_required=${error instanceof Error ? error.message : String(error)}`
    }).catch(() => undefined);
  }
  console.error(error);
  process.exit(1);
});
