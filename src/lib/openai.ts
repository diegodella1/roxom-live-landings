import { env, modelForAgent } from "./config";
import { extractJson } from "./json";
import { hashValue } from "./hash";
import { recordAgentRun } from "./db";
import type { AgentName } from "./types";

type RunAgentOptions<T> = {
  agent: AgentName;
  landingId?: number;
  system: string;
  prompt: string;
  fallback: () => T;
  useWebSearch?: boolean;
};

const responseText = (payload: any) => {
  if (typeof payload.output_text === "string") return payload.output_text;
  const chunks: string[] = [];
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") chunks.push(content.text);
      if (content.type === "text" && typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n");
};

export const runJsonAgent = async <T>(options: RunAgentOptions<T>): Promise<T> => {
  const model = modelForAgent(options.agent);
  const inputHash = hashValue({ system: options.system, prompt: options.prompt });

  if (!env.openaiApiKey) {
    const output = options.fallback();
    recordAgentRun({
      landingId: options.landingId,
      agentName: options.agent,
      model: `${model}:fallback`,
      inputHash,
      output,
      status: "ok"
    });
    return output;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: options.system },
          { role: "user", content: options.prompt }
        ],
        tools: options.useWebSearch ? [{ type: "web_search_preview" }] : undefined
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
    }

    const payload = await response.json();
    const output = extractJson<T>(responseText(payload));
    recordAgentRun({
      landingId: options.landingId,
      agentName: options.agent,
      model,
      inputHash,
      output,
      status: "ok"
    });
    return output;
  } catch (error) {
    const output = options.fallback();
    recordAgentRun({
      landingId: options.landingId,
      agentName: options.agent,
      model,
      inputHash,
      output,
      status: "error",
      error: error instanceof Error ? error.message : String(error)
    });
    return output;
  }
};
