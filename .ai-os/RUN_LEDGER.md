# Repository Run Ledger

The run ledger preserves enough private local state for a material coding task
to survive task boundaries without committing prompts, model logs, or raw
traces. It is an explicit recorder, not an autonomous orchestrator.

## Layout

```text
.ai-os/runs/<run-id>/
  task.json
  status.json
  model-runs.jsonl
  execution-plan.json       # optional, immutable once prepared
  unit-state.json           # optional, atomically replaced
  reviews/
  evidence/
  integration/
```

`task.json` is the validated starting packet and is never rewritten by the
ledger. `status.json` is atomically replaced after an allowed transition and
retains its full transition history. `model-runs.jsonl` accepts validated,
append-only invocation records with a unique model-run ID, the owning
orchestration-run ID, and the task ID.

For orchestrated implementation, `execution-plan.json` freezes bounded unit
ownership, dependency waves, capability roles, skills, verification, and dated
builder/reviewer/integration routes. `unit-state.json` binds each unit to an
externally created related worktree and retains its assignment, exact builder
head, review count, and lifecycle. Versioned review receipts live in `reviews/`.

All records live under the ignored `.ai-os/runs/` path. The tool refuses unsafe
IDs, symlinked roots, mismatched run/task identities, duplicate model-run IDs,
hardlinked managed records, secret-like content, oversized private records,
invalid timestamps, and invalid state transitions. A stable per-run advisory
lock serializes cooperating status and model-log writers.

Execution preparation also rejects overlapping ownership, dependency cycles,
weak risk/role pairings, and unknown dependencies. Assignment requires an
absolute worktree outside the main checkout but in the same Git repository, on
the frozen branch and full clean base commit. Dependencies must already be
approved. Review requires a clean frozen head, the planned reviewer model route,
and a task and identity distinct from the builder. The first BLOCK permits one
focused repair; a second BLOCK records escalation.

## Commands

Create a task packet as JSON matching `schemas/task-packet.schema.json`, then:

```bash
python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  create --run-id RUN-ID --task /private/local/task.json

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  transition --run-id RUN-ID --status building \
  --summary "Builder started within the approved ownership area."

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  record-model --run-id RUN-ID --document /private/local/model-run.json

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  prepare-execution --run-id RUN-ID \
  --document /private/local/execution-plan.json

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  assign-unit --run-id RUN-ID --unit-id UNIT-ID \
  --executor-task-id CODEX-TASK-ID --executor-identity BUILDER-ID \
  --worktree /absolute/path/to/external/worktree \
  --branch BRANCH --base-commit FULL-COMMIT-ID

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  unit-status --run-id RUN-ID --unit-id UNIT-ID --status running \
  --summary "Builder started within the frozen ownership area."

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  unit-status --run-id RUN-ID --unit-id UNIT-ID --status ready_for_review \
  --head-commit FULL-BUILDER-HEAD \
  --summary "Focused verification passed at the frozen head."

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  record-review --run-id RUN-ID --unit-id UNIT-ID \
  --reviewer-task-id REVIEW-TASK-ID --reviewer-identity REVIEWER-ID \
  --provider PROVIDER --model MODEL --effort EFFORT \
  --frozen-head FULL-BUILDER-HEAD --verdict PASS \
  --findings /private/local/review-findings.json \
  --summary "No actionable findings."

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  integration-plan --run-id RUN-ID

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  validate --run-id RUN-ID

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os summary
```

The summary separates known cost from unknown-cost records and groups outcomes
by role and provider/model. It makes no claim that price caused quality and does
not choose a future model automatically.

## Boundary

Creating or updating a record does not create a task, branch, or worktree; call
a model; dispatch a reviewer; integrate code; commit; publish; deploy; spend
money; or grant permission. Worktree paths, executor identities, and review
results are supplied by the active runtime and verified against the frozen
contract. Those operations remain governed by the
repository's adopted delivery process and the owner's current decision.
