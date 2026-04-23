import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { listActiveLandings, listLandings } from "@/lib/db";
import { recoverInterruptedRuns } from "@/lib/recovery";

export const runtime = "nodejs";

export async function GET() {
  const recovered = recoverInterruptedRuns();
  return NextResponse.json({
    ok: true,
    service: "news-live-landings",
    pipelineEnv: env.pipelineEnv,
    landings: listLandings(100).length,
    liveLandings: listActiveLandings().length,
    features: {
      designSpecFallbackNormalization: true,
      criticGuidanceMode: true,
      publishConservativeFallbackOnRepairStop: true
    },
    configured: {
      openai: Boolean(env.openaiApiKey),
      telegramBot: Boolean(env.telegramBotToken),
      telegramChat: env.telegramAllowedChatIds.length > 0,
      telegramChatCount: env.telegramAllowedChatIds.length,
      telegramWebhookSecret: Boolean(env.telegramWebhookSecret),
      slackBot: Boolean(env.slackBotToken),
      slackSigningSecret: Boolean(env.slackSigningSecret),
      slackChannelCount: env.slackAllowedChannelIds.length,
      internalCronSecret: Boolean(env.internalCronSecret)
    },
    recoveredInterruptedRuns: recovered,
    timestamp: new Date().toISOString()
  });
}
