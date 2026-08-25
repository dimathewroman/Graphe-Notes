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
  dispatches/
  evidence/
  integration/
  cleanup/
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
Before assignment or review work, `dispatches/` stores an append-only receipt
for the visible, user-owned task. It distinguishes the frozen expected route,
the requested route accepted by the runtime, and an actual route observed from
authoritative metadata. When the runtime exposes only accepted explicit routing,
the actual route remains `unexposed`; the receipt must not claim it was observed.
New review receipts bind their expected/requested/runtime-accepted/actual route
evidence directly to that dispatch. They do not accept caller-supplied
provider/model/effort values, and a PASS or integration plan does not turn an
unexposed actual route into an observed one.
`cleanup/` stores final-handoff and integration evidence, archived visible
builder/reviewer task IDs, removed-worktree and recoverable-ref evidence, plus
separate Git worktree and Codex open-task inventories after an approved unit is
complete. A `Git worktree removed` fact is not a `Codex task archived` fact:
both are required before an execution run can become complete. The Codex
inventory can leave the current coordinator task open only when it names that
task and records the exception as intentional.
Copy `templates/DISPATCH_RECEIPT.json` or `templates/CLEANUP_RECEIPT.json` to a
private local path and replace every placeholder before recording it.

All records live under the ignored `.ai-os/runs/` path. The tool refuses unsafe
IDs, symlinked roots, mismatched run/task identities, duplicate model-run IDs,
hardlinked managed records, secret-like content, oversized private records,
invalid timestamps, invalid state transitions, and symlinked managed receipt
directories. A stable per-run advisory
lock serializes cooperating status and model-log writers.

Execution preparation also rejects overlapping ownership, dependency cycles,
weak risk/role pairings, and unknown dependencies. Assignment requires an
absolute worktree outside the main checkout but in the same Git repository, on
the frozen branch and full clean base commit. Dependencies must already be
approved. Review requires a clean frozen head, the planned reviewer model route,
and a task and identity distinct from the builder. The first BLOCK permits one
focused repair; a second BLOCK records escalation.

Every builder and reviewer dispatch is fail-closed until its receipt records an
accepted route request, matching frozen expected/requested route, visible
topology, and verified worktree identity. An observed actual-route mismatch, a
hidden-sidecar topology, or a fork without deliberate inherited-route equality
evidence is rejected. Task/worktree cleanup is recorded only after final-handoff
and integration evidence, then task archival, then worktree removal, with an
exact recoverable ref for the approved head. Its post-action Git worktree
inventory must no longer list the removed worktree, and its Codex open-task
inventory must no longer list any archived builder/reviewer task ID. The runtime
withholds completion if either inventory is missing or reports a visible task
still open.

## Archived alpha.7-shaped history

A run with neither `dispatches/` nor `cleanup/` is classified as
`archival_read_only_alpha7_shaped`. This preserves an older alpha.7-shaped
record for inspection and model-run summary, but it is not an authoritative
alpha.8 execution history: validation reports its archival status rather than
success, and the runtime refuses planning, dispatch, assignment, transitions,
reviews, integration, model-run recording, cleanup, and completion.

There is no migration path from that layout into alpha.8 execution authority.
The classification is deliberately a local layout boundary, not proof of which
runtime originally created the files. If an alpha.8 run loses both receipt
directories and resembles the older layout, it receives the same inert archive
classification; missing evidence can only remove authority, never restore it.
If either directory is missing, symlinked, or not a real directory while the
other is present, `inspect` reports `invalid_receipt_topology`; it is likewise
non-authoritative and every authority-bearing operation refuses it.

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
  record-dispatch --run-id RUN-ID \
  --document /private/local/builder-dispatch-receipt.json

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  assign-unit --run-id RUN-ID --unit-id UNIT-ID \
  --executor-task-id CODEX-TASK-ID --executor-identity BUILDER-ID \
  --dispatch-id DISPATCH-ID \
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
  record-dispatch --run-id RUN-ID \
  --document /private/local/reviewer-dispatch-receipt.json

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  record-review --run-id RUN-ID --unit-id UNIT-ID \
  --reviewer-task-id REVIEW-TASK-ID --reviewer-identity REVIEWER-ID \
  --dispatch-id DISPATCH-ID \
  --frozen-head FULL-BUILDER-HEAD --verdict PASS \
  --findings /private/local/review-findings.json \
  --summary "No actionable findings."

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  integration-plan --run-id RUN-ID

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  record-cleanup --run-id RUN-ID \
  --document /private/local/cleanup-receipt.json

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  inspect --run-id RUN-ID

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os \
  validate --run-id RUN-ID

python3 .ai-os/scripts/run_ledger.py --runtime-root .ai-os summary
```

The summary separates known cost from unknown-cost records, reports the count
of archival runs, and groups outcomes by role and provider/model. It makes no
claim that price caused quality and does not choose a future model automatically.

## Boundary

Creating or updating a record does not create a task, branch, or worktree; call
a model; dispatch a reviewer; integrate code; commit; publish; deploy; spend
money; or grant permission. Worktree paths, executor identities, and review
results are supplied by the active runtime and verified against the frozen
contract. Those operations remain governed by the
repository's adopted delivery process and the owner's current decision.
