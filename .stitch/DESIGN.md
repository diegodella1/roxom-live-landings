# Design System: Dark Editorial News Features

## 1. Visual Theme & Atmosphere

The landing must feel like a premium dark financial-news feature: full-screen image lead, dense evidence modules, clean article pacing, and high-contrast data. It should resemble a serious crypto/geopolitical newsroom microsite rather than a generic SaaS landing page or TV slide.

The experience is article-first. The reader should move through a hero, briefing, timeline, quotes, data/impact, reactions, gallery, and source footer.

## 2. Color Palette & Roles

- **Base Black** `#060707` — Primary background.
- **Surface Black** `#191919` — Quote, reaction, and chart cards.
- **Context Green Tint** `#031f11` — Data/impact and high-context bands.
- **Accent Green** `#1ae784` — Links, tags, source labels, chart bars, timeline dots.
- **Critical Red** `#e7000b` — Live/breaking badge and true critical risk only.
- **Primary Text** `#ffffff` — Headlines and important labels.
- **Secondary Text** `rgba(255,255,255,0.60)` — Body metadata and supporting text.
- **Tertiary Text** `rgba(255,255,255,0.40)` — Credits, timestamps, source footnotes.
- **Border** `rgba(255,255,255,0.10)` — Panels and section separators.

No purple, no blue gradients, no beige palette, no neon TV glow. Green is sharp and controlled, not decorative.

## 3. Typography Rules

- **Primary:** DM Sans for headlines, article copy, cards, and labels.
- **Mono:** JetBrains Mono for metadata, source tags, numbers, chart labels, dates, and timestamps.
- Headlines are heavy, compact, and editorial. Use `clamp(32px, 5.5vw, 68px)` for hero scale.
- Article body uses 17px, 1.75 line-height, max width around 900px.
- Source labels and metadata are 9-11px mono uppercase where appropriate.

## 4. Layout System

1. **Sticky Masthead:** 80px, centered neutral text mark, no brand dependency.
2. **Hero:** 92vh full-bleed image with dark vertical and horizontal gradients, live badge, topic tags, date, headline, subheadline, image credit.
3. **Article:** Centered 900px column, long-form sections with real subheads, source tags, and occasional inline images.
4. **Timeline:** Dark green/black band with vertical timeline and source footnotes.
5. **Quotes:** Two-column cards on desktop, one-column on mobile.
6. **Data & Impact:** Green-tinted band, stat cards, and at least one chart-like visual when source data exists.
7. **Reactions:** Source/actor cards showing who said or reported what.
8. **Gallery:** 4-column image grid on desktop, 2-column on mobile.
9. **Footer Sources:** Bottom source summary with publication/update context.

## 5. Topic-Aware Treatment

- **Person:** portrait/face-first hero when available, article should include biography/context, current relevance, timeline, quotes, and image gallery.
- **Event/Crisis:** scene-first hero, timeline is essential, quotes and reactions should be prominent.
- **Market/Crypto/Finance:** data/stat section must be strong, include chart visuals and market reaction cards.
- **Institution/Company:** hero can use building, product, logo-adjacent source image, or relevant operation visual; emphasize actors and data.

## 6. Motion & Interaction

Use restrained fade-up and optional scanline effect. No carousel, no auto-scroll, no marquee/ticker movement, no horizontal panning. Hover states can scale gallery images subtly and change card borders.

## 7. Content Quality Rules

- 7-10 substantial sections when source material supports it.
- Every factual section carries source URLs.
- Use exact quotes only when supported; otherwise use reactions/source cards.
- Sources appear inline and at the bottom.
- Do not fabricate images, quotes, numbers, or dates.
- Use fallback images only when they are topically relevant and properly credited.

## 8. Anti-Patterns

No generic card-only landing. No TV slide language. No Roxom branding. No text-only visual sections. No unsupported claims. No weak one-paragraph summaries. No broken image links. No overdecorated neon/glassmorphism.
