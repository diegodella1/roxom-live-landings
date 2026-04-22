import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config";
import { handleTelegramUpdate } from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (env.telegramWebhookSecret && secret !== env.telegramWebhookSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const result = await handleTelegramUpdate(await request.json());
  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "telegram" });
}
