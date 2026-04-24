import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AgentName } from "./types";

const claudeRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), ".claude");
const claudeAgentsRoot = path.join(claudeRoot, "agents");
const claudeSkillsRoot = path.join(claudeRoot, "skills");

const agentFileMap: Partial<Record<AgentName, string>> = {
  discover: "Discover.md",
  research: "Research.md",
  writer: "Writer.md",
  designer: "Designer.md",
  critic: "Critic.md",
  publisher: "Publisher.md",
  liveMonitor: "LiveMonitor.md",
  liveUpdater: "LiveUpdater.md",
  telegramGateway: "TelegramGateway.md"
};

const stripFrontmatter = (markdown: string) =>
  markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "").trim();

const unique = <T>(values: T[]) => [...new Set(values)];

export const claudeAgentPathFor = (agent: AgentName) => {
  const fileName = agentFileMap[agent];
  return fileName ? path.join(claudeAgentsRoot, fileName) : null;
};

export const claudeSkillPathFor = (skillId: "contentStyleSkill" | "editorialStandardsSkill" | "liveNewsDesignSystemSkill") => {
  switch (skillId) {
    case "contentStyleSkill":
      return path.join(claudeSkillsRoot, "content-style.md");
    case "editorialStandardsSkill":
      return path.join(claudeSkillsRoot, "editorial-standards.md");
    case "liveNewsDesignSystemSkill":
      return path.join(claudeSkillsRoot, "live-news-design-system.md");
  }
};

const readMarkdown = async (filePath: string) => readFile(filePath, "utf8");

export const loadClaudeAgentPrompt = async (agent: AgentName) => {
  const filePath = claudeAgentPathFor(agent);
  if (!filePath) return "";

  const agentMarkdown = await readMarkdown(filePath);
  const agentBody = stripFrontmatter(agentMarkdown);
  const skillRefs = unique(Array.from(agentBody.matchAll(/@([a-z0-9-]+\.md)/gi)).map(match => match[1]));

  if (skillRefs.length === 0) return agentBody;

  const resolvedSkills = await Promise.all(skillRefs.map(async ref => {
    const skillPath = path.join(claudeSkillsRoot, ref);
    const skillMarkdown = await readMarkdown(skillPath);
    return `## Shared Skill: ${ref}\n${stripFrontmatter(skillMarkdown)}`;
  }));

  return [
    `# Claude Agent Runtime Prompt`,
    `Source file: ${path.relative(process.cwd(), filePath)}`,
    "",
    agentBody,
    "",
    "# Resolved Shared Skills",
    ...resolvedSkills
  ].join("\n").trim();
};
