# News Landings Stitch Design System

## Purpose

This project generates source-forward news landings from Telegram requests. Every landing should feel like a modern editorial visual brief, not a branded TV page.

## Design Principles

- Lead with one strong visual or visualized evidence area.
- Keep hero copy concise: headline, subheadline, topic, timestamp.
- Make sources visible and close to the claims they support.
- Use restrained motion: scroll reveal, subtle parallax, and horizontal story frames only when useful.
- Avoid neon broadcast styling, brand-specific references, decorative clutter, and unsourced visual claims.

## Page Structure

1. Hero: large visual cover with concise text.
2. Source Rail: visible list of primary outlets.
3. Story Frames: claim cards with section-level source links.
4. Data/Context: short sourced facts, no invented quotes.
5. Update History: material changes with source URLs.

## Visual Language

- Background: deep neutral editorial surface.
- Text: high-contrast off-white.
- Accent: clear blue for links and live state.
- Cards: low-radius, readable, source-first.
- Typography: Space Grotesk for headlines and labels, Work Sans for body.

## Implementation Notes

- React components must stay modular and typed.
- Landing JSON carries `designSpec.source = "stitch"` for every new landing.
- Every factual section must include `sourceUrls`.
- Quotes must be exact and source-bound; otherwise omit quotes.
