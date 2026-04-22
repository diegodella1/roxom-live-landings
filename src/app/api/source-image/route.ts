import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedProtocols = new Set(["http:", "https:"]);

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) return new NextResponse("Missing url", { status: 400 });

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(rawUrl);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (!allowedProtocols.has(sourceUrl.protocol)) {
    return new NextResponse("Unsupported image url", { status: 400 });
  }

  try {
    const response = await fetch(sourceUrl.toString(), {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: sourceUrl.origin,
        "User-Agent":
          "Mozilla/5.0 (compatible; NewsLiveLandings/1.0; +https://diegodella.ar/landings)"
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) return new NextResponse("Image unavailable", { status: response.status });
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return new NextResponse("URL is not an image", { status: 415 });

    return new NextResponse(response.body, {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Content-Type": contentType
      }
    });
  } catch {
    return new NextResponse("Image fetch failed", { status: 502 });
  }
}
