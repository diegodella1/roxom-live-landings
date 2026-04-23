import { getAppSetting, setAppSetting } from "./db";
import type { AgentName } from "./types";

export type PipelineFlowId = "create" | "live";

export type PipelineFlowConfig = {
  id: PipelineFlowId;
  label: string;
  stages: AgentName[];
  availableStages: AgentName[];
};

type StoredPipelineConfig = {
  create: AgentName[];
  live: AgentName[];
};

const settingKey = "pipeline_agent_config_v1";

const createAvailable: AgentName[] = ["research", "writer", "designStyle", "designer", "critic", "publisher"];
const liveAvailable: AgentName[] = ["liveMonitor", "liveUpdater", "critic", "publisher"];

const defaultConfig: StoredPipelineConfig = {
  create: ["research", "writer", "designer", "critic", "publisher"],
  live: ["liveMonitor", "liveUpdater", "critic", "publisher"]
};

const ensureUniqueKnown = (stages: AgentName[], available: AgentName[]) =>
  stages.filter((stage, index) => available.includes(stage) && stages.indexOf(stage) === index);

const validateCreateFlow = (stages: AgentName[]) => {
  const cleaned = ensureUniqueKnown(stages, createAvailable);
  for (const required of ["research", "writer", "designer", "critic", "publisher"] satisfies AgentName[]) {
    if (!cleaned.includes(required)) throw new Error(`Create flow must include ${required}.`);
  }
  if (cleaned.at(-1) !== "publisher") throw new Error("Create flow must end with publisher.");
  if (cleaned.indexOf("research") > cleaned.indexOf("writer")) throw new Error("Research must run before writer.");
  if (cleaned.indexOf("writer") > cleaned.indexOf("designer")) throw new Error("Writer must run before designer.");
  if (cleaned.includes("designStyle")) {
    const designStyleIndex = cleaned.indexOf("designStyle");
    if (designStyleIndex < cleaned.indexOf("writer") || designStyleIndex > cleaned.indexOf("designer")) {
      throw new Error("Design Style must be placed after writer and before designer.");
    }
  }
  if (cleaned.indexOf("designer") > cleaned.indexOf("critic")) throw new Error("Designer must run before critic.");
  return cleaned;
};

const validateLiveFlow = (stages: AgentName[]) => {
  const cleaned = ensureUniqueKnown(stages, liveAvailable);
  for (const required of ["liveMonitor", "critic", "publisher"] satisfies AgentName[]) {
    if (!cleaned.includes(required)) throw new Error(`Live flow must include ${required}.`);
  }
  if (cleaned.at(-1) !== "publisher") throw new Error("Live flow must end with publisher.");
  if (cleaned.indexOf("liveMonitor") > cleaned.indexOf("critic")) throw new Error("Live Monitor must run before critic.");
  if (cleaned.includes("liveUpdater")) {
    const updaterIndex = cleaned.indexOf("liveUpdater");
    if (updaterIndex < cleaned.indexOf("liveMonitor") || updaterIndex > cleaned.indexOf("critic")) {
      throw new Error("Live Updater must be placed after Live Monitor and before Critic.");
    }
  }
  return cleaned;
};

const parseStored = () => {
  const raw = getAppSetting(settingKey, JSON.stringify(defaultConfig));
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPipelineConfig>;
    return {
      create: validateCreateFlow(parsed.create ?? defaultConfig.create),
      live: validateLiveFlow(parsed.live ?? defaultConfig.live)
    };
  } catch {
    return defaultConfig;
  }
};

export const getPipelineConfig = (): PipelineFlowConfig[] => {
  const config = parseStored();
  return [
    {
      id: "create",
      label: "Create Flow",
      stages: config.create,
      availableStages: createAvailable
    },
    {
      id: "live",
      label: "Live Update Flow",
      stages: config.live,
      availableStages: liveAvailable
    }
  ];
};

export const savePipelineConfig = (input: Partial<Record<PipelineFlowId, AgentName[]>>) => {
  const current = parseStored();
  const next: StoredPipelineConfig = {
    create: input.create ? validateCreateFlow(input.create) : current.create,
    live: input.live ? validateLiveFlow(input.live) : current.live
  };
  setAppSetting(settingKey, JSON.stringify(next));
  return getPipelineConfig();
};

export const getCreateFlowStages = () => parseStored().create;
export const getLiveFlowStages = () => parseStored().live;
