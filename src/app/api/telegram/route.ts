import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config";
import { handleTelegramUpdate } from "@/lib/telegram";

export const runtime = "nodejs";

const isLongRunningCommand = (update: unknown) => {
  const text =
    typeof update === "object" && update !== null && "message" in update
      ? (update as { message?: { text?: unknown } }).message?.text
      : undefined;

  if (typeof text !== "string") return false;
  const command = text.trim().split(/\s+/)[0];
  return command === "/start_live" || command === "/force_update";
};

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (env.telegramWebhookSecret && secret !== env.telegramWebhookSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const update = await request.json();
  if (isLongRunningCommand(update)) {
    void handleTelegramUpdate(update).catch(error => {
      console.error("[telegram] background command failed", error);
    });
    return NextResponse.json({ ok: true, queued: true });
  }

  const result = await handleTelegramUpdate(update);
  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "telegram" });
}
