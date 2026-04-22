import type { ImageCandidate, LandingContent, Source, VisualAsset } from "./types";

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
    return absoluteUrl.toString();
  } catch {
    return null;
  }
};

export const discoverSourceImages = async (sources: Source[], limit = 5, timeoutMs = 5000) => {
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
          sourceUrl: source.url
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

export const discoverWikimediaImages = async (topic: string, limit = 2) => {
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
        sourceUrl: page.fullurl ?? ""
      } satisfies ImageCandidate));
  } catch {
    return [];
  }
};

export const withDiscoveredSourceImages = async (content: LandingContent): Promise<LandingContent> => {
  if (content.visuals.some(visual => visual.type === "image" && visual.url?.startsWith("http"))) return content;
  const images = [
    ...await discoverSourceImages(content.sources, 4, 3200),
    ...await discoverWikimediaImages(content.topic, 2)
  ];
  if (images.length === 0) return content;

  const imageVisuals = images.map(image => ({
    type: "image",
    title: image.title,
    url: image.url,
    credit: image.credit,
    alt: image.alt
  }) satisfies VisualAsset);

  return {
    ...content,
    visuals: [...imageVisuals, ...content.visuals]
  };
};
