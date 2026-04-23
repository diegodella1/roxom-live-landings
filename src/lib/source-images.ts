import type { ImageCandidate, LandingContent, Source, VisualAsset } from "./types";

const candidateKey = (candidate: Pick<ImageCandidate, "url" | "title" | "credit">) =>
  [
    String(candidate.url ?? "").trim().toLowerCase(),
    String(candidate.title ?? "").trim().toLowerCase(),
    String(candidate.credit ?? "").trim().toLowerCase()
  ].join("|");

const imagePathPattern = /\.(avif|gif|jpe?g|png|webp)(?:$|[?#])/i;
const knownImageHostPattern = /(^|\.)((dims|assets)\.apnews\.com|pbs\.twimg\.com|images\.[^/]+|image\.[^/]+|media\.[^/]+|cdn\.[^/]+)$/i;

const isLowValueImageUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    const pathname = url.pathname.toLowerCase();
    const hostname = url.hostname.toLowerCase();
    return (
      hostname.endsWith("wikipedia.org")
      || hostname.endsWith("wikimedia.org")
      || pathname.includes("social-share")
      || pathname.includes("share-card")
      || pathname.includes("/social/")
      || pathname.includes("/share/")
      || pathname.includes("thumb")
      || pathname.includes("thumbnail")
    );
  } catch {
    return true;
  }
};

export const isLikelyRenderableImageUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    const pathname = url.pathname.toLowerCase();
    const hostname = url.hostname.toLowerCase();

    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (pathname.endsWith(".svg")) return false;
    if (imagePathPattern.test(pathname)) return true;
    if (hostname === "dims.apnews.com" || hostname === "assets.apnews.com") return true;
    if (hostname === "apnews.com" && pathname.startsWith("/article/")) return false;
    if (hostname.endsWith("reutersconnect.com")) return false;
    if (pathname.includes("/article/") || pathname.includes("/news/") || pathname.includes("/story/")) return false;
    return knownImageHostPattern.test(hostname);
  } catch {
    return false;
  }
};

const extractMetaImage = (html: string) => {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:url["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image:src["'][^>]*>/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["'][^>]*>/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].replaceAll("&amp;", "&");
  }

  return null;
};

const toAbsoluteImageUrl = (imageUrl: string, sourceUrl: string) => {
  try {
    const absoluteUrl = new URL(imageUrl, sourceUrl);
    if (!["http:", "https:"].includes(absoluteUrl.protocol)) return null;
    if (absoluteUrl.pathname.endsWith(".svg")) return null;
    return isLikelyRenderableImageUrl(absoluteUrl.toString()) ? absoluteUrl.toString() : null;
  } catch {
    return null;
  }
};

export const discoverSourceImages = async (sources: Source[], limit = 8, timeoutMs = 5000) => {
  const results = await Promise.allSettled(
    sources.slice(0, limit).map(async source => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(source.url, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent":
              "Mozilla/5.0 (compatible; NewsLiveLandings/1.0; +https://diegodella.ar/landings)"
          },
          signal: controller.signal
        });
        if (!response.ok) return null;
        const rawImageUrl = extractMetaImage(await response.text());
        const imageUrl = rawImageUrl ? toAbsoluteImageUrl(rawImageUrl, source.url) : null;
        if (!imageUrl) return null;
        return {
          url: imageUrl,
          title: source.title,
          credit: source.outlet,
          alt: `Image associated with ${source.title}`,
          sourceUrl: source.url,
          relevance: "direct",
          relevanceReason: `OpenGraph image from source article: ${source.title}`
        } satisfies ImageCandidate;
      } finally {
        clearTimeout(timeout);
      }
    })
  );

  const imageUrls = new Set<string>();
  return results
    .flatMap(result => (result.status === "fulfilled" && result.value ? [result.value] : []))
    .filter(image => {
      if (imageUrls.has(image.url)) return false;
      imageUrls.add(image.url);
      return true;
    });
};

export const discoverWikimediaImages = async (topic: string, limit = 4) => {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: topic,
    gsrlimit: String(limit),
    prop: "pageimages|info",
    pithumbsize: "1600",
    inprop: "url",
    format: "json",
    origin: "*"
  });

  try {
    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; NewsLiveLandings/1.0; +https://diegodella.ar/landings)"
      },
      signal: AbortSignal.timeout(4500)
    });
    if (!response.ok) return [];
    const data = await response.json() as {
      query?: {
        pages?: Record<string, {
          title?: string;
          fullurl?: string;
          thumbnail?: { source?: string };
        }>;
      };
    };

    return Object.values(data.query?.pages ?? {})
      .filter(page => page.thumbnail?.source && page.fullurl)
      .map(page => ({
        url: page.thumbnail?.source ?? "",
        title: page.title ?? topic,
        credit: "Wikimedia / Wikipedia",
        alt: `Reference image for ${page.title ?? topic}`,
        sourceUrl: page.fullurl ?? "",
        relevance: "contextual",
        relevanceReason: `Wikimedia reference image for ${page.title ?? topic}`
      } satisfies ImageCandidate));
  } catch {
    return [];
  }
};

export const withDiscoveredSourceImages = async (content: LandingContent, targetImageCount = 8): Promise<LandingContent> => {
  const sanitizedVisuals = content.visuals.filter(visual =>
    visual.type !== "image" || (
      typeof visual.url === "string"
      && visual.url.startsWith("http")
      && isLikelyRenderableImageUrl(visual.url)
      && !isLowValueImageUrl(visual.url)
    )
  );
  const existingImageVisuals = sanitizedVisuals.filter(
    (visual): visual is VisualAsset & { type: "image"; url: string } => visual.type === "image" && Boolean(visual.url?.startsWith("http"))
  );
  if (existingImageVisuals.length >= targetImageCount && sanitizedVisuals.length === content.visuals.length) return content;

  const images = [
    ...await discoverSourceImages(content.sources, 10, 3200),
    ...await discoverWikimediaImages(content.topic, 4)
  ];
  if (images.length === 0) {
    return sanitizedVisuals.length === content.visuals.length
      ? content
      : {
          ...content,
          visuals: sanitizedVisuals
        };
  }

  const existingKeys = new Set(existingImageVisuals.map(visual => candidateKey({
    url: visual.url,
    title: visual.title,
    credit: visual.credit
  })));
  const imageVisuals = images
    .filter(image => {
      if (isLowValueImageUrl(image.url)) return false;
      const key = candidateKey(image);
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    })
    .slice(0, Math.max(0, targetImageCount - existingImageVisuals.length))
    .map(image => ({
      type: "image",
      title: image.title,
      url: image.url,
      credit: image.credit,
      alt: image.alt,
      relevance: image.relevance,
      relevanceReason: image.relevanceReason
    }) satisfies VisualAsset);

  if (imageVisuals.length === 0) {
    return sanitizedVisuals.length === content.visuals.length
      ? content
      : {
          ...content,
          visuals: sanitizedVisuals
        };
  }

  return {
    ...content,
    visuals: [...sanitizedVisuals, ...imageVisuals]
  };
};
