import { NextRequest, NextResponse } from "next/server";
import { handleSlackEnvelope, isLongRunningSlackEvent, postSlackMessage, verifySlackSignature } from "@/lib/slack";
import { recoverInterruptedRuns } from "@/lib/recovery";
import type { SlackEnvelope } from "@/lib/slack";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  recoverInterruptedRuns();
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");
  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const envelope = JSON.parse(rawBody) as SlackEnvelope;

  if (envelope.type === "url_verification") {
    return NextResponse.json({ challenge: envelope.challenge });
  }

  if (envelope.event && isLongRunningSlackEvent(envelope.event)) {
    const event = envelope.event;
    const threadTs = event.thread_ts ?? event.ts;
    if (event.channel && threadTs) {
      void postSlackMessage({
        channel: event.channel,
        threadTs,
        text: "QUEUED | Processing request in this thread."
      }).catch(error => {
        console.error("[slack] queued reply failed", error);
      });
    }
    void handleSlackEnvelope(envelope).catch(error => {
      console.error("[slack] background command failed", error);
    });
    return NextResponse.json({ ok: true, queued: true });
  }

  const result = await handleSlackEnvelope(envelope);
  return NextResponse.json(result);
}

export async function GET() {
  recoverInterruptedRuns();
  return NextResponse.json({ ok: true, endpoint: "slack" });
}
