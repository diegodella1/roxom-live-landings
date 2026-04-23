import { runJsonAgent } from "../openai";
import { getAgentOverride } from "../admin-agents";
import { editorialSystem } from "./prompts";

export type DiscoveryCandidate = {
  topic: string;
  rationale: string;
  urgency: "low" | "medium" | "high";
  sourceUrls: string[];
  visualPotential: "low" | "medium" | "high";
  score: number;
};

export type DiscoveryOutput = {
  selectedTopic: string;
  selectedRationale: string;
  candidates: DiscoveryCandidate[];
};

export const discoverLiveTopic = async (hint?: string) => {
  const adminOverride = await getAgentOverride("discover");
  return runJsonAgent<DiscoveryOutput>({
    agent: "discover",
    system: editorialSystem,
    useWebSearch: true,
    prompt: `
Discover one timely, source-rich topic for a live news landing.

Sources and discovery:
- Use current web search.
- Prefer AP, Reuters, Google News-style current coverage, Bloomberg, BBC, NYT, FT, WSJ, CNBC, CoinDesk, and relevant new media.
- The selected topic must have enough credible sources for a useful landing.
- Prefer topics with strong visual potential: photos, maps, charts, timelines, market moves, named actors, locations, or measurable deltas.
- Avoid stale, generic, low-source, or purely opinion topics.
- If the user gives a hint, use it as a direction, not as a fixed topic.

User hint:
${hint || "No hint. Choose the best current topic."}

Return JSON:
{
  "selectedTopic": string,
  "selectedRationale": string,
  "candidates": [
    {
      "topic": string,
      "rationale": string,
      "urgency": "low"|"medium"|"high",
      "sourceUrls": string[],
      "visualPotential": "low"|"medium"|"high",
      "score": number
    }
  ]
}

Return 3-5 candidates. Scores must be 0-100 and grounded in source quality, urgency, landing suitability, and visual potential.
${adminOverride}
`,
    fallback: () => ({
      selectedTopic: hint?.trim() || "global markets live update",
      selectedRationale: "Fallback discovery selected a broad topic because live web discovery was unavailable.",
      candidates: [
        {
          topic: hint?.trim() || "global markets live update",
          rationale: "Fallback candidate for the live landing pipeline.",
          urgency: "medium",
          sourceUrls: ["https://www.reuters.com/", "https://apnews.com/"],
          visualPotential: "medium",
          score: 50
        }
      ]
    })
  });
};
