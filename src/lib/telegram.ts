import { env } from "./config";
import { getLandingBySlug, listLandings, recordTelegramEvent, summarizeTokenUsageSince, updateLandingStatus } from "./db";
import { discoverLiveTopic } from "./agents/discover";
import { publicFinalUrl, runLiveCycleForLanding, startLiveLanding } from "./pipeline";
import { slugify } from "./slug";
import type { LandingRecord } from "./types";

type TelegramMessage = {
  message_id: number;
  chat: { id: number | string };
  text?: string;
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
};

const sendTelegramMessage = async (chatId: string | number, text: string) => {
  recordTelegramEvent("out", { text }, String(chatId));

  if (!env.telegramBotToken) {
    console.log(`[telegram:fallback] ${chatId}: ${text}`);
    return;
  }

  await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: false
    })
  });
};

export const notifyTelegram = async (text: string) => {
  const recipients = env.telegramAllowedChatIds.length > 0 ? env.telegramAllowedChatIds : env.telegramChatId ? [env.telegramChatId] : [];
  await Promise.all(recipients.map(chatId => sendTelegramMessage(chatId, text)));
};

const assertAllowedChat = (chatId: string | number) => {
  if (env.telegramAllowedChatIds.length > 0 && !env.telegramAllowedChatIds.includes(String(chatId))) {
    throw new Error("Unauthorized Telegram chat.");
  }
};

const helpText = () => [
  "Live news landing commands:",
  "/discover_live [hint]",
  "/start_live <topic>",
  "/status <slug_or_topic>",
  "/force_update <slug_or_topic>",
  "/cancel_live <slug_or_topic>",
  "/pause_live <slug_or_topic>",
  "/resume_live <slug_or_topic>",
  "/final_url <slug_or_topic>",
  "/landings",
  "/help"
].join("\n");

const findSlug = (value: string) => {
  const direct = getLandingBySlug(value);
  if (direct) return value;
  return slugify(value);
};

const retryableStatuses = new Set(["blocked", "cancelled", "failed"]);

const tokenUsageMessage = (startedAt: string) => {
  const usage = summarizeTokenUsageSince(startedAt);
  return `TOKENS | input=${usage.inputTokens} | output=${usage.outputTokens} | total=${usage.totalTokens}`;
};

const landingStatusMessage = (landing: LandingRecord) => {
  if (landing.status === "live") {
    return `FINAL URL READY | topic=${landing.topic} | final_url=${landing.finalUrl} | index_url=${env.landingsIndexUrl}`;
  }

  if (landing.status === "blocked") {
    const blocker = landing.content.updateHistory.find(update => update.materiality === "BLOCKER");
    const reason = blocker?.summary ? ` | reason=${blocker.summary.slice(0, 700)}` : "";
    return `BLOCKED | topic=${landing.topic} | slug=${landing.slug} | status=${landing.status}${reason}`;
  }

  if (landing.status === "cancelled") {
    return `CANCELLED | topic=${landing.topic} | slug=${landing.slug}`;
  }

  if (landing.status === "failed") {
    return `RETRY NEEDED | topic=${landing.topic} | slug=${landing.slug} | status=${landing.status}`;
  }

  return `IN PROGRESS | topic=${landing.topic} | slug=${landing.slug} | status=${landing.status}`;
};

const stageMessage = (topic: string, stage: string, detail?: string) => {
  const suffix = detail ? ` | detail=${detail.slice(0, 500)}` : "";
  return `STAGE | topic=${topic} | stage=${stage}${suffix}`;
};

export const handleTelegramUpdate = async (update: TelegramUpdate) => {
  const message = update.message;
  if (!message?.text) return { ok: true, ignored: true };

  const chatId = message.chat.id;
  assertAllowedChat(chatId);
  const [command, ...rest] = message.text.trim().split(/\s+/);
  const arg = rest.join(" ").trim();
  recordTelegramEvent("in", update, String(chatId), command);

  try {
    if (command === "/help" || command === "/start") {
      await sendTelegramMessage(chatId, helpText());
      return { ok: true };
    }

    if (command === "/landings") {
      const latest = listLandings(10)
        .filter(landing => landing.status === "live")
        .map(landing => `- ${landing.slug}: ${landing.finalUrl}`)
        .join("\n");
      await sendTelegramMessage(chatId, [`LANDINGS INDEX: ${env.landingsIndexUrl}`, latest].filter(Boolean).join("\n"));
      return { ok: true };
    }

    if (command === "/discover_live") {
      const startedAt = new Date().toISOString();
      await sendTelegramMessage(chatId, `DISCOVERY STARTED${arg ? ` | hint=${arg}` : ""}`);
      const discovery = await discoverLiveTopic(arg);
      await sendTelegramMessage(
        chatId,
        `TOPIC SELECTED | topic=${discovery.selectedTopic} | reason=${discovery.selectedRationale.slice(0, 700)}`
      );

      const existing = getLandingBySlug(slugify(discovery.selectedTopic));
      const landing =
        existing && !retryableStatuses.has(existing.status)
          ? existing
          : await startLiveLanding(discovery.selectedTopic, (stage, detail) =>
              sendTelegramMessage(chatId, stageMessage(discovery.selectedTopic, stage, detail))
            );
      await sendTelegramMessage(chatId, landingStatusMessage(landing));
      await sendTelegramMessage(chatId, tokenUsageMessage(startedAt));
      return { ok: true, slug: landing.slug, topic: discovery.selectedTopic };
    }

    if (command === "/start_live") {
      if (!arg) throw new Error("Usage: /start_live <topic>");
      const startedAt = new Date().toISOString();
      const existing = getLandingBySlug(slugify(arg));
      if (existing && !retryableStatuses.has(existing.status)) {
        await sendTelegramMessage(chatId, landingStatusMessage(existing));
        await sendTelegramMessage(chatId, tokenUsageMessage(startedAt));
        return { ok: true, slug: existing.slug, existing: true };
      }

      await sendTelegramMessage(chatId, `PROJECT STARTED | topic=${arg}${existing ? " | mode=retry" : ""}`);
      const landing = await startLiveLanding(arg, (stage, detail) => sendTelegramMessage(chatId, stageMessage(arg, stage, detail)));
      await sendTelegramMessage(chatId, landingStatusMessage(landing));
      await sendTelegramMessage(chatId, tokenUsageMessage(startedAt));
      return { ok: true, slug: landing.slug };
    }

    if (command === "/status") {
      if (!arg) throw new Error("Usage: /status <slug_or_topic>");
      const landing = getLandingBySlug(findSlug(arg));
      if (!landing) throw new Error(`No landing found for ${arg}`);
      await sendTelegramMessage(
        chatId,
        `STATUS | topic=${landing.topic} | slug=${landing.slug} | status=${landing.status} | final_url=${landing.finalUrl} | last_updated=${landing.updatedAt}`
      );
      return { ok: true };
    }

    if (command === "/final_url") {
      if (!arg) throw new Error("Usage: /final_url <slug_or_topic>");
      const slug = findSlug(arg);
      await sendTelegramMessage(chatId, `FINAL URL | final_url=${publicFinalUrl(slug)} | index_url=${env.landingsIndexUrl}`);
      return { ok: true };
    }

    if (command === "/force_update") {
      if (!arg) throw new Error("Usage: /force_update <slug_or_topic>");
      const startedAt = new Date().toISOString();
      const result = await runLiveCycleForLanding(findSlug(arg));
      await sendTelegramMessage(
        chatId,
        `FORCE UPDATE | slug=${result.landing.slug} | materiality=${result.monitor?.materiality ?? "SKIPPED"} | updated=${result.updated}`
      );
      await sendTelegramMessage(chatId, tokenUsageMessage(startedAt));
      return { ok: true };
    }

    if (command === "/pause_live" || command === "/resume_live") {
      if (!arg) throw new Error(`Usage: ${command} <slug_or_topic>`);
      const slug = findSlug(arg);
      const landing = getLandingBySlug(slug);
      if (!landing) throw new Error(`No landing found for ${arg}`);
      updateLandingStatus(landing.id, command === "/pause_live" ? "paused" : "live");
      await sendTelegramMessage(chatId, `${command === "/pause_live" ? "PAUSED" : "RESUMED"} | slug=${slug}`);
      return { ok: true };
    }

    if (command === "/cancel_live") {
      if (!arg) throw new Error("Usage: /cancel_live <slug_or_topic>");
      const slug = findSlug(arg);
      const landing = getLandingBySlug(slug);
      if (!landing) throw new Error(`No landing found for ${arg}`);
      updateLandingStatus(landing.id, "cancelled");
      await sendTelegramMessage(chatId, `CANCELLED | slug=${slug}`);
      return { ok: true };
    }

    await sendTelegramMessage(chatId, `Unknown command: ${command}\n\n${helpText()}`);
    return { ok: true };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    await sendTelegramMessage(chatId, `BLOCKER | stage=telegram | action_required=${messageText}`);
    return { ok: false, error: messageText };
  }
};
