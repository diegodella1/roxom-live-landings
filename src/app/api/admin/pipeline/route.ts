import { NextRequest, NextResponse } from "next/server";
import { requestHasAdminAccess, unauthorizedAdminResponse } from "@/lib/admin-auth";
import { getPipelineConfig, savePipelineConfig } from "@/lib/pipeline-config";
import type { AgentName } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!requestHasAdminAccess(request)) return unauthorizedAdminResponse();
  return NextResponse.json({ ok: true, flows: getPipelineConfig() });
}

export async function POST(request: NextRequest) {
  if (!requestHasAdminAccess(request)) return unauthorizedAdminResponse();
  const body = await request.json().catch(() => ({})) as { create?: AgentName[]; live?: AgentName[] };
  try {
    const flows = savePipelineConfig({
      create: Array.isArray(body.create) ? body.create : undefined,
      live: Array.isArray(body.live) ? body.live : undefined
    });
    return NextResponse.json({ ok: true, flows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
