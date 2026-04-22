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

const estimateTokens = (value: unknown) => Math.ceil(JSON.stringify(value).length / 4);

const usageFromPayload = (payload: any, fallbackInput: unknown, fallbackOutput: unknown) => {
  const inputTokens = Number(payload.usage?.input_tokens ?? payload.usage?.prompt_tokens ?? estimateTokens(fallbackInput));
  const outputTokens = Number(payload.usage?.output_tokens ?? payload.usage?.completion_tokens ?? estimateTokens(fallbackOutput));
  const totalTokens = Number(payload.usage?.total_tokens ?? inputTokens + outputTokens);
  return { inputTokens, outputTokens, totalTokens };
};

export const runJsonAgent = async <T>(options: RunAgentOptions<T>): Promise<T> => {
  const model = modelForAgent(options.agent);
  const inputHash = hashValue({ system: options.system, prompt: options.prompt });
  const promptInput = { system: options.system, prompt: options.prompt };

  if (!env.openaiApiKey) {
    const output = options.fallback();
    recordAgentRun({
      landingId: options.landingId,
      agentName: options.agent,
      model: `${model}:fallback`,
      inputHash,
      output,
      status: "ok",
      tokenUsage: {
        inputTokens: estimateTokens(promptInput),
        outputTokens: estimateTokens(output),
        totalTokens: estimateTokens(promptInput) + estimateTokens(output)
      }
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
    const tokenUsage = usageFromPayload(payload, promptInput, output);
    recordAgentRun({
      landingId: options.landingId,
      agentName: options.agent,
      model,
      inputHash,
      output,
      status: "ok",
      tokenUsage
    });
    return output;
  } catch (error) {
    const output = options.fallback();
    const inputTokens = estimateTokens(promptInput);
    const outputTokens = estimateTokens(output);
    recordAgentRun({
      landingId: options.landingId,
      agentName: options.agent,
      model,
      inputHash,
      output,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      tokenUsage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens
      }
    });
    return output;
  }
};
