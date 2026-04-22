import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 32 }}>
      <div style={{ maxWidth: 620 }}>
        <p style={{ color: "var(--primary)", fontFamily: "var(--font-display)", textTransform: "uppercase" }}>
          Signal not found
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 64, lineHeight: 1, margin: 0 }}>Landing unavailable</h1>
        <p style={{ color: "rgba(227,226,226,.72)", lineHeight: 1.6 }}>
          This landing is not published, was blocked by Critic, or does not exist yet.
        </p>
        <Link href="/landings" style={{ color: "var(--tertiary)" }}>
          Back to landings
        </Link>
      </div>
    </main>
  );
}
