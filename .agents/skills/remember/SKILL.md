---
name: remember
description: Record stable local decisions and context for Neighborhood Investment Intelligence. Use when the user asks Codex to remember a durable preference, workflow rule, data-source decision, or architectural choice for future work.
---

# Remember

Maintain a concise local `memory.md` at the repository root. The file is intentionally ignored by Git.

## What to store

- Durable user preferences and explicit decisions.
- Stable project conventions not already documented elsewhere.
- Current blockers, pending approvals, and the next confirmed step.
- Short references to canonical repository documentation.

## What not to store

- API keys, credentials, tokens, private personal data, or copied `.env` values.
- Speculation, transient command output, or large code excerpts.
- Facts already captured accurately in tracked documentation; link to them instead.

## Workflow

1. Read the existing `memory.md` if present.
2. Add or update the smallest relevant entry with a date and source of the decision.
3. Remove stale statements only when later evidence clearly supersedes them.
4. Confirm that no secret or sensitive value was recorded.
