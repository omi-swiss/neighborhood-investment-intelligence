---
name: recover
description: Safely resume or repair interrupted Neighborhood Investment Intelligence work. Use after a failed command, partial edit, interrupted session, merge conflict, or uncertain repository state.
---

# Recover

Restore a trustworthy working state while preserving user work.

## Workflow

1. Inspect `git status`, the current branch, recent diffs, and any running process output.
2. Classify files as user-owned, task-owned, generated, or unknown. Treat unknown changes as user-owned.
3. Reconstruct the last confirmed objective from the task and repository evidence.
4. Reproduce the failure with the narrowest safe command when useful.
5. Repair only task-owned files. Work around unrelated changes.
6. Run focused validation and report what remains uncertain.

## Safety rules

- Never use `git reset --hard`, destructive checkout, broad recursive deletion, or overwrite unknown files.
- Never recover secrets by printing `.env`, credential stores, or shell history.
- Do not delete generated data until its exact target and reproducibility are confirmed.
- Ask for direction if continuing would require discarding or overwriting user work.
