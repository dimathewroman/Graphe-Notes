# Repository Engineering Policy

## Purpose

Give a local or remote coding task enough portable structure to preserve the
repository's own product truth, produce reviewable evidence, and recover from a
failed change without copying private cross-project context into the project.

## Task record

Use `schemas/task-packet.schema.json` and `templates/TASK_PACKET.md` for material
work when the repository has not already adopted an equivalent or stronger
record. A task record identifies the outcome, non-goals, risk, ownership,
contracts, verification, evidence, budget, approvals, and stop conditions. It
does not become product authority merely because an agent generated it.

For adaptive orchestration candidates, preserve that v1 packet and link it
through the strict contracts and bundle validator documented in
`ADAPTIVE_CONTRACTS.md`. A schema-valid record is not proof that authentication,
dispatch, telemetry, installation, or activation occurred.

## Evidence

Use `schemas/evidence-receipt.schema.json` and
`templates/HUMAN_EVIDENCE_BUNDLE.md` when a compact durable handoff adds value.
State failed commands, baseline failures, uncertainty, missing live/device
evidence, and remaining approval gates. Compilation alone is never enough to
claim product correctness.

## Durable run and model records

For material work, `.ai-os/scripts/run_ledger.py` may create one private run
under `.ai-os/runs/<run-id>/` from a valid task packet. `task.json` is immutable;
`status.json` changes only through allowed transitions and retains history;
`model-runs.jsonl` is append-only. Record one model invocation only after its
facts are known. Unknown tokens or cost remain null and summaries count unknown
cost separately. A run record coordinates evidence but never creates a
worktree, invokes a model, grants ownership, approves integration, or changes
the repository's own governance.

## Risk and authority

Use the repository's adopted risk framework. Where none exists, the portable
R0-R3 descriptions in `policy/risk-tiers.yaml` are a starting point. The
authority values in `policy/authority.yaml` describe requested task effects;
actual permissions and owner approvals remain enforced by the current runtime,
repository, and user decision.

## Local state

The following paths are project-owned and ignored by default:

- `.ai-os/local/`
- `.ai-os/runs/`
- `.ai-os/data/`
- `.ai-os/cache/`
- `.ai-os/generated/local/`

The project profile is created from the selected central overlay on first
installation, then becomes project-owned. A later upstream profile refresh is
an explicit operation because local repository truth can diverge legitimately.
