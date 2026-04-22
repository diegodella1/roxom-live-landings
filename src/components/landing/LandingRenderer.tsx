"use client";

/* eslint-disable @next/next/no-img-element -- News images come from arbitrary source domains discovered at runtime. */
import { motion } from "framer-motion";
import type { LandingContent, VisualAsset } from "@/lib/types";
import styles from "./landing.module.css";

const imageProxyUrl = (url: string) => `/landings/api/source-image?url=${encodeURIComponent(url)}`;

function VisualTile({ type, index, visual }: { type: string; index: number; visual?: VisualAsset }) {
  if (visual?.type === "image" && visual.url) {
    return (
      <figure className={styles.photoVisual}>
        <img src={imageProxyUrl(visual.url)} alt={visual.alt} loading={index === 0 ? "eager" : "lazy"} />
        <figcaption>{visual.credit}</figcaption>
      </figure>
    );
  }

  if (type === "chart" || type === "data") {
    const bars = [42, 68, 54, 82, 63].map(value => Math.max(18, Math.min(92, value + index * 3)));
    return (
      <div className={styles.chartVisual} aria-hidden="true">
        <div className={styles.chartLine} />
        {bars.map((height, barIndex) => (
          <span style={{ height: `${height}%` }} key={`${height}-${barIndex}`} />
        ))}
      </div>
    );
  }

  if (type === "map") {
    return (
      <div className={styles.mapVisual} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (type === "image") {
    return <div className={styles.imageVisual} aria-hidden="true" />;
  }

  return (
    <div className={styles.abstractVisual} aria-hidden="true">
      <span />
      <span />
    </div>
  );
}

export function LandingRenderer({ content }: { content: LandingContent }) {
  const imageVisuals = content.visuals.filter((visual): visual is VisualAsset & { url: string } => (
    visual.type === "image" && Boolean(visual.url)
  ));
  const heroImage = imageVisuals[0];

  return (
    <main className={styles.shell} data-layout={content.designSpec?.layout ?? "visual-cover"}>
      <div className={styles.editorialTexture} aria-hidden="true" />

      <section className={styles.hero}>
        {heroImage && (
          <figure className={styles.heroMedia}>
            <img src={imageProxyUrl(heroImage.url)} alt={heroImage.alt} fetchPriority="high" />
            <figcaption>{heroImage.credit}</figcaption>
          </figure>
        )}
        <motion.div
          className={styles.heroCopy}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className={styles.kicker}>
            <span className={styles.liveDot} />
            Live Landing
          </div>
          <h1>{content.headline}</h1>
          <p>{content.subheadline}</p>
          <div className={styles.meta}>
            <span>{content.topic}</span>
            <span>Updated {new Date(content.lastUpdatedUtc).toLocaleString()}</span>
          </div>
        </motion.div>
        <motion.aside
          className={styles.signalPanel}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          aria-label="Key sourced data"
        >
          <div className={styles.panelLabel}>What Matters</div>
          {content.dataPoints.slice(0, 4).map(point => (
            <div className={styles.dataRow} key={point.label}>
              <strong>{point.value}</strong>
              <span>{point.label}</span>
            </div>
          ))}
        </motion.aside>
      </section>

      <div className={styles.ticker}>
        <span>{content.summary}</span>
      </div>

      <section className={styles.storyBlock} aria-label="Story frames">
        <div className={styles.storyHeader}>
          <span>Story</span>
          <small>{content.sections.length} sourced frames</small>
        </div>
        <div className={styles.sections}>
          {content.sections.map((section, index) => {
            const sectionImage = section.visualHint === "image" ? imageVisuals[index % Math.max(imageVisuals.length, 1)] : undefined;
            return (
            <motion.article
              className={styles.card}
              key={section.id}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.14) }}
            >
              <div>
                <span className={styles.eyebrow}>{section.eyebrow}</span>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
                {section.sourceUrls?.length > 0 && (
                  <div className={styles.sectionSources}>
                    {section.sourceUrls.map((sourceUrl, sourceIndex) => (
                      <a href={sourceUrl} target="_blank" rel="noreferrer" key={sourceUrl}>
                        Source {sourceIndex + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.visualTile}>
                <VisualTile type={section.visualHint} index={index} visual={sectionImage ?? imageVisuals[index + 1]} />
              </div>
            </motion.article>
          );
          })}
        </div>
      </section>

      <section className={styles.quoteData}>
        {content.quotes.slice(0, 2).map(quote => (
          <blockquote className={styles.quote} key={quote.quote}>
            <p>&ldquo;{quote.quote}&rdquo;</p>
            <cite>{quote.attribution}</cite>
          </blockquote>
        ))}
        <div className={styles.sources}>
          <h2>Sources</h2>
          {content.sources.map(source => (
            <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>
              <strong>{source.outlet}</strong>
              <span>{source.title}</span>
            </a>
          ))}
        </div>
      </section>

      {content.updateHistory.length > 0 && (
        <section className={styles.updates}>
          <h2>Live Update History</h2>
          {content.updateHistory.slice(0, 5).map(update => (
            <div key={`${update.timestampUtc}-${update.summary}`}>
              <strong>{update.materiality}</strong>
              <p>{update.summary}</p>
              <span>{new Date(update.timestampUtc).toLocaleString()}</span>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
