"use client";

import { useMemo, useState } from "react";
import styles from "./admin.module.css";

type EditableAgent = {
  id:
    | "telegramGateway"
    | "discover"
    | "research"
    | "writer"
    | "designer"
    | "critic"
    | "publisher"
    | "liveMonitor"
    | "liveUpdater";
  label: string;
  role: string;
  filePath: string;
  status: "active" | "role-only";
  currentDescription: string;
  override: string;
};

type ApiState = "idle" | "loading" | "saving" | "error" | "saved";

const storageKey = "news-live-admin-token";

const adminApiPath = () => {
  if (typeof window === "undefined") return "/api/admin/agents";
  return window.location.pathname.startsWith("/landings/")
    ? "/landings/api/admin/agents"
    : "/api/admin/agents";
};

export function AdminAgentEditor({ initialToken, initialAgents }: { initialToken: string; initialAgents: EditableAgent[] }) {
  const [token, setToken] = useState(() => (
    initialToken || (typeof window !== "undefined" ? window.localStorage.getItem(storageKey) ?? "" : "")
  ));
  const [agents, setAgents] = useState<EditableAgent[]>(initialAgents);
  const [selectedId, setSelectedId] = useState<EditableAgent["id"]>(initialAgents[0]?.id ?? "writer");
  const [draft, setDraft] = useState(initialAgents[0]?.override ?? "");
  const [state, setState] = useState<ApiState>("idle");
  const [message, setMessage] = useState("");

  const selectedAgent = useMemo(
    () => agents.find(agent => agent.id === selectedId) ?? agents[0],
    [agents, selectedId]
  );

  const authHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    ...(token ? { "x-admin-token": token } : {})
  }), [token]);

  const loadAgents = async () => {
    setState("loading");
    setMessage("");
    const response = await fetch(adminApiPath(), { headers: token ? { "x-admin-token": token } : undefined });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Could not load agents.");
      return;
    }
    setAgents(payload.agents);
    setSelectedId(payload.agents[0]?.id ?? "writer");
    setDraft(payload.agents[0]?.override ?? "");
    setState("idle");
  };

  const updateToken = (value: string) => {
    setToken(value);
    if (value) window.localStorage.setItem(storageKey, value);
    else window.localStorage.removeItem(storageKey);
  };

  const selectAgent = (agent: EditableAgent) => {
    setSelectedId(agent.id);
    setDraft(agent.override);
  };

  const save = async () => {
    if (!selectedAgent) return;
    setState("saving");
    setMessage("");
    const response = await fetch(adminApiPath(), {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ agentId: selectedAgent.id, override: draft })
    });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Could not save agent override.");
      return;
    }
    setAgents(current => current.map(agent => (
      agent.id === selectedAgent.id ? { ...agent, override: payload.override } : agent
    )));
    setState("saved");
    setMessage(`${selectedAgent.label} saved. New runs will use this override.`);
  };

  const clear = async () => {
    setDraft("");
    if (!selectedAgent) return;
    setState("saving");
    const response = await fetch(adminApiPath(), {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ agentId: selectedAgent.id, override: "" })
    });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Could not clear agent override.");
      return;
    }
    setAgents(current => current.map(agent => (
      agent.id === selectedAgent.id ? { ...agent, override: "" } : agent
    )));
    setState("saved");
    setMessage(`${selectedAgent.label} override cleared.`);
  };

  return (
    <div className={styles.editor}>
      <aside className={styles.sidebar}>
        <label className={styles.tokenField}>
          <span>Admin Token</span>
          <input
            value={token}
            onChange={event => updateToken(event.target.value)}
            placeholder="ADMIN_TOKEN"
            type="password"
          />
        </label>
        <button className={styles.secondaryButton} onClick={loadAgents} type="button">
          Load Agents
        </button>
        <div className={styles.agentList} role="list">
          {agents.map(agent => (
            <button
              className={agent.id === selectedId ? styles.activeAgent : styles.agentButton}
              key={agent.id}
              onClick={() => selectAgent(agent)}
              type="button"
            >
              <span>{agent.label}</span>
              <em>{agent.status === "active" ? "Active prompt" : "Role only"}</em>
              <small>{agent.filePath}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className={styles.panel}>
        {selectedAgent ? (
          <>
            <div className={styles.panelHeader}>
              <div>
                <p>{selectedAgent.id}</p>
                <h2>{selectedAgent.label}</h2>
                <span>{selectedAgent.role}</span>
              </div>
              <strong className={selectedAgent.status === "active" ? styles.activeBadge : styles.roleBadge}>
                {selectedAgent.status === "active" ? "Runtime prompt" : "Pipeline role"}
              </strong>
              <div className={styles.actions}>
                <button className={styles.secondaryButton} onClick={clear} type="button" disabled={state === "saving"}>
                  Clear
                </button>
                <button className={styles.primaryButton} onClick={save} type="button" disabled={state === "saving"}>
                  {state === "saving" ? "Saving" : "Save"}
                </button>
              </div>
            </div>
            <div className={styles.descriptionBlock}>
              <div>
                <span>Current Description</span>
                <p>{selectedAgent.currentDescription}</p>
              </div>
              <button className={styles.secondaryButton} onClick={() => setDraft(selectedAgent.currentDescription)} type="button">
                Edit From Current
              </button>
            </div>
            <textarea
              className={styles.textarea}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              placeholder={
                selectedAgent.status === "active"
                  ? `Add runtime instructions for ${selectedAgent.label}. Example: Require the first three sections to be Lead, Why It Matters, and Who Is Involved.`
                  : `Save operator notes or desired behavior for ${selectedAgent.label}. This role is not injected into an LLM prompt yet.`
              }
              spellCheck={false}
            />
            <div className={styles.status} data-state={state}>
              {message || (selectedAgent.status === "active"
                ? "Overrides are appended to the selected agent at runtime. Empty text means the code default is used."
                : "This role is loaded for visibility and editing, but current execution is deterministic code rather than an LLM prompt.")}
            </div>
          </>
        ) : (
          <div className={styles.empty}>
            <h2>No agents loaded</h2>
            <p>Enter the admin token and load the editable agent list.</p>
          </div>
        )}
      </section>
    </div>
  );
}
