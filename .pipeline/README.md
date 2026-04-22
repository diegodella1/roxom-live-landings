# Pipeline Config Namespace

This repository is now operated as Codex-first.

## Canonical naming
- Use `.pipeline` as the neutral configuration namespace in docs and operations.
- Legacy `.claude` paths are still supported for backward compatibility.

## Compatibility policy
- Existing agent and skill files currently live under `.claude/`.
- New operational docs should reference `.pipeline` first, then mention `.claude` fallback when needed.
- A full file move can be done later without behavior changes, since prompts mostly use relative `@file.md` references.

## Current effective locations
- Agents: `.claude/agents/`
- Skills: `.claude/skills/`
- Assets: `.claude/assets/`

Use this file as the bridge so operations are no longer tied to Claude branding.
