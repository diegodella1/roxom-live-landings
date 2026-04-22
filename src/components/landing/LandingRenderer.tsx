"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import type { LandingContent } from "@/lib/types";
import { NeonBackdrop } from "./NeonBackdrop";
import styles from "./landing.module.css";

export function LandingRenderer({ content }: { content: LandingContent }) {
  const { scrollYProgress } = useScroll();
  const heroShift = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const gridShift = useTransform(scrollYProgress, [0, 1], [0, 90]);

  return (
    <main className={styles.shell}>
      <motion.div className={styles.parallaxGrid} style={{ y: gridShift }} aria-hidden="true" />
      <NeonBackdrop />

      <section className={styles.hero}>
        <motion.div
          className={styles.heroCopy}
          style={{ y: heroShift }}
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
        <motion.div
          className={styles.signalPanel}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
        >
          <div className={styles.panelLabel}>Signal Stack</div>
          {content.dataPoints.slice(0, 3).map(point => (
            <div className={styles.dataRow} key={point.label}>
              <strong>{point.value}</strong>
              <span>{point.label}</span>
            </div>
          ))}
        </motion.div>
      </section>

      <div className={styles.ticker}>
        <span>{content.summary}</span>
      </div>

      <section className={styles.sections}>
        {content.sections.map((section, index) => (
          <motion.article
            className={styles.card}
            key={section.id}
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: Math.min(index * 0.08, 0.24) }}
          >
            <div>
              <span className={styles.eyebrow}>{section.eyebrow}</span>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </div>
            <div className={styles.visualTile}>
              <span>{section.visualHint}</span>
            </div>
          </motion.article>
        ))}
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
