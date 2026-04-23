import { mkdir, readFile, writeFile } from "node:fs/promises";
import { env } from "./config";
import type { AgentName } from "./types";
import { isSystemPromptId, listSystemPrompts, saveSystemPrompt, systemPromptPath, type SystemPromptId } from "./system-prompts";

export type EditableAgentId = AgentName;
export type EditableEntryId = EditableAgentId | SystemPromptId;

export type EditableAgent = {
  id: EditableEntryId;
  label: string;
  role: string;
  filePath: string;
  status: "active" | "role-only" | "system";
  currentDescription: string;
  mdPath: string;
  markdown: string;
};

type AgentDefinition = Omit<EditableAgent, "mdPath" | "markdown">;
type AgentRecordDefinition = Omit<EditableAgent, "mdPath" | "markdown" | "id" | "status"> & {
  id: EditableAgentId;
  status: "active" | "role-only";
};

const agentDefinitions: AgentRecordDefinition[] = [
  {
    id: "telegramGateway",
    label: "Telegram Gateway",
    role: "Remote control, command parsing, status replies, and operational alerts.",
    filePath: "src/lib/telegram.ts",
    status: "role-only",
    currentDescription:
      "Receives Telegram commands, verifies allowed chats, starts discovered or requested landings, reports stage progress, sends final URLs, lists live landings, and can trigger live update cycles. This role does not currently call an LLM directly."
  },
  {
    id: "slackGateway",
    label: "Slack Gateway",
    role: "Channel mentions, thread replies, status updates, and operational alerts in Slack.",
    filePath: "src/lib/slack.ts",
    status: "role-only",
    currentDescription:
      "Receives Slack app mentions in approved channels, keeps work inside threads, interprets reply-to-URL context as an update or source-driven request, reports stage progress, sends final URLs, and can trigger live update cycles. This role does not currently call an LLM directly."
  },
  {
    id: "designStyle",
    label: "Design Style Agent",
    role: "Selects the visual style system for image treatment based on topic, request, and template.",
    filePath: "src/lib/agents/design-style.ts",
    status: "role-only",
    currentDescription:
      "Chooses one approved visual style from the project style catalog for image editing or generation. It should pick styles based on explicit user request first, then topic and template fit, and return a clear rationale plus prompt directives and negative directives for downstream image treatment."
  },
  {
    id: "discover",
    label: "Discover Agent",
    role: "Finds the best timely, source-rich topic when Diego asks the system to choose.",
    filePath: "src/lib/agents/discover.ts",
    status: "active",
    currentDescription:
      "Uses current web search to select one timely landing topic with a meaningful new development from the last 8 hours. It searches broad news beats and outlets when the hint is generic, returns only a real news topic, and stops the process if no valid source-rich topic can be verified."
  },
  {
    id: "research",
    label: "Research Agent",
    role: "Finds current sources, source-bound facts, images, quotes, and data before writing.",
    filePath: "src/lib/agents/research.ts",
    status: "active",
    currentDescription:
      "Builds the factual source package for a requested topic, preserving the freshest current angle and last-8-hours developments when available. It gathers credible current sources, source-bound facts, image candidates, quotes, and data points that downstream writing and design agents must stay faithful to."
  },
  {
    id: "writer",
    label: "Writer Agent",
    role: "Creates headline, summary, sections, quotes, and data points from the research package.",
    filePath: "src/lib/agents/writer.ts",
    status: "active",
    currentDescription:
      "Turns the research package into a structured editorial brief: headline, subheadline, summary, sections, quotes, data points, update history, and source usage. It owns first-pass top-line clarity: what changed now, why it matters, who is involved, current status, evidence, reactions, uncertainty, and next steps."
  },
  {
    id: "designer",
    label: "Designer Agent",
    role: "Chooses layout, visual hierarchy, design spec, visuals, and final LandingContent structure.",
    filePath: "src/lib/agents/designer.ts",
    status: "active",
    currentDescription:
      "Converts the written brief and research package into final LandingContent. It owns layout choice, first-viewport clarity, visual hierarchy, hero treatment, visual relevance, section composition, source footer structure, and a complete Stitch designSpec. It also performs critic-requested repair revisions and must replace malformed designSpec output instead of preserving partial fields."
  },
  {
    id: "critic",
    label: "Critic Agent",
    role: "Reviews safety, sourcing, section quality, visual relevance, and publication readiness.",
    filePath: "src/lib/agents/critic.ts",
    status: "active",
    currentDescription:
      "Reviews the generated landing before publication as a red team. It checks source support, factual caution, unsafe claims, freshness, first-viewport clarity, section quality, visual relevance, publication readiness, and designSpec completeness. Its issues must be understandable and directly repairable; design/layout issues should stay in changes_requested rather than blocked, and repeated identical feedback stops repair early instead of spending all attempts."
  },
  {
    id: "publisher",
    label: "Publisher",
    role: "Persists approved content and exposes the final public URL.",
    filePath: "src/lib/pipeline.ts",
    status: "role-only",
    currentDescription:
      "Saves approved landing content, marks the landing live, keeps blocked or failed pages unpublished, and exposes the final URL through the landings route. This role is deterministic pipeline code and does not currently call an LLM directly."
  },
  {
    id: "liveMonitor",
    label: "Live Monitor",
    role: "Checks live pages for material verified changes on later cycles.",
    filePath: "src/lib/agents/live.ts",
    status: "active",
    currentDescription:
      "Uses current web search to monitor an already-live landing for net-new verified updates, especially since lastUpdatedUtc and inside the last 8 hours. It classifies materiality as no change, minor, important, critical, or blocker, and returns a sourced delta summary."
  },
  {
    id: "liveUpdater",
    label: "Live Updater",
    role: "Applies verified live deltas while preserving editorial and visual quality.",
    filePath: "src/lib/agents/live.ts",
    status: "active",
    currentDescription:
      "Applies an important or critical monitor delta to the full LandingContent JSON. It integrates the fresh update into the narrative and first viewport while preserving structure, source credits, article depth, relevant visuals, and the complete source list before Critic reviews the update."
  }
];

const storeDirectory = () => process.env.AGENT_OVERRIDES_DIR ?? (env.pipelineEnv === "prod" ? "/data" : "/tmp");
const storePath = () => `${storeDirectory().replace(/\/$/, "")}/admin-agent-overrides.json`;
const markdownDirectory = () => process.env.AGENT_MD_DIR ?? `${storeDirectory().replace(/\/$/, "")}/agents`;
const markdownPath = (agentId: EditableAgentId) => `${markdownDirectory().replace(/\/$/, "")}/${agentId}.md`;

const defaultAgentMarkdown = (agent: AgentRecordDefinition) => `# ${agent.label}

## Role
${agent.role}

## Current Description
${agent.currentDescription}

## Operating Instructions
- Follow the project editorial system and source requirements.
- Produce first-pass publishable quality whenever this role calls an LLM.
- Keep outputs specific, source-backed, understandable, and directly repairable.
`;

const readOverrides = async (): Promise<Partial<Record<EditableAgentId, string>>> => {
  try {
    return JSON.parse(await readFile(storePath(), "utf8")) as Partial<Record<EditableAgentId, string>>;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return {};
    throw error;
  }
};

export const listEditableEntries = async (): Promise<EditableAgent[]> => {
  const overrides = await readOverrides();
  const agents = await Promise.all(agentDefinitions.map(async agent => {
    const mdPath = markdownPath(agent.id);
    const markdown = await readAgentMarkdown(agent, overrides[agent.id]);
    return {
      ...agent,
      mdPath,
      markdown
    };
  }));
  const systemPrompts = await listSystemPrompts();
  return [
    ...systemPrompts.map(prompt => ({
      id: prompt.id,
      label: prompt.label,
      role: "Shared system prompt",
      filePath: "src/lib/agents/prompts.ts",
      status: "system" as const,
      currentDescription: prompt.description,
      mdPath: systemPromptPath(prompt.id),
      markdown: prompt.markdown
    })),
    ...agents
  ];
};

export const listEditableAgents = listEditableEntries;

export const getAgentOverride = async (agentId: EditableAgentId) => {
  const agent = agentDefinitions.find(definition => definition.id === agentId);
  if (!agent) return "";
  const overrides = await readOverrides();
  const markdown = (await readAgentMarkdown(agent, overrides[agent.id])).trim();
  if (!markdown) return "";
  return `\n\nAdmin Markdown instructions for ${agentId} agent:\n${markdown}\n`;
};

const readAgentMarkdown = async (agent: AgentRecordDefinition, legacyOverride?: string) => {
  try {
    return await readFile(markdownPath(agent.id), "utf8");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    const markdown = legacyOverride?.trim()
      ? `# ${agent.label}

## Role
${agent.role}

## Current Description
${agent.currentDescription}

## Admin Instructions
${legacyOverride.trim()}
`
      : defaultAgentMarkdown(agent);
    await mkdir(markdownDirectory(), { recursive: true });
    await writeFile(markdownPath(agent.id), `${markdown.trim()}\n`, "utf8");
    return `${markdown.trim()}\n`;
  }
};

export const saveEditableEntryMarkdown = async (agentId: EditableEntryId, markdown: string) => {
  if (isSystemPromptId(agentId)) {
    return saveSystemPrompt(agentId, markdown);
  }
  const agent = agentDefinitions.find(definition => definition.id === agentId);
  if (!agent) {
    throw new Error(`Unknown editable agent: ${agentId}`);
  }
  const cleaned = markdown.trim() || defaultAgentMarkdown(agent).trim();
  await mkdir(markdownDirectory(), { recursive: true });
  await writeFile(markdownPath(agentId), `${cleaned}\n`, "utf8");
  return `${cleaned}\n`;
};

export const saveAgentMarkdown = saveEditableEntryMarkdown;

export const isEditableEntryId = (value: unknown): value is EditableEntryId =>
  (typeof value === "string" && agentDefinitions.some(agent => agent.id === value)) || isSystemPromptId(value);

export const isEditableAgentId = isEditableEntryId;
