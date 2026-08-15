# Adaptive Orchestrated Coding Delivery

Use this guide for an implementation that needs more than one role, worktree,
or independent review. It is the canonical operating workflow for adaptive
agent-assisted coding. Project instructions may add stricter product, privacy,
or release gates; they may not silently weaken owner-approved boundaries.

## Governing principle

Use the smallest builder/reviewer topology that preserves exclusive ownership,
independent judgment, and trustworthy integration. Parallelism must reduce real
elapsed time, not multiply discovery, context loading, or test runs.

This guide governs work design. Runtime availability still governs which task,
worktree, model, and review capabilities can actually be used.

## Roles and authority

The **primary orchestrator** audits existing work and reuse, turns the approved
outcome into an implementation-ready task record, selects topology/model,
creates and monitors visible worktree tasks where the runtime supports them,
coordinates dependencies, integrates exact reviewed commits, runs the combined
gate, updates delivery records, and closes worktrees/tasks.

For a multi-role implementation, the primary orchestrator does **not** author product code, tests, migrations, build configuration, UI, scripts, or fixtures.
Assign that work to a builder. A single-agent, genuinely small task may combine
roles only when the task record explains why separate orchestration/review adds
no meaningful independence; owner approval is required for an exception to the
independent-review rule.

Hidden sidecar agents may research, inspect, or validate a bounded question.
They never replace an owner-visible worktree builder without explicit owner
approval. A material pivot beyond the approved product/architecture scope stops
for an owner decision.

## Definition of Ready for a builder

Every builder receives one task record containing:

- Exact owner-visible outcome; included and excluded scope.
- Product/architecture context and reusable existing owners, components,
  calculations, routes, or contracts.
- Exclusive files/modules; dependencies and frozen interfaces.
- Risk tier plus privacy, security, financial, migration, and rollback limits.
- Required tests/evidence, completion-report format, and acceptance oracle.
- Stop conditions, owner decisions, and a report-before-60-minutes checkpoint.

Do not dispatch a builder with an open-ended instruction to "investigate and
fix" when the task can first be made ready from read-only evidence.

## Risk and model routing

Use the named model only when that exact runtime capability is exposed. Do not
silently replace an unavailable named tier: stop, report the unavailable
capability and impact, and obtain the owner's routing decision.

| Risk | Default builder | Use for | Review |
|---|---|---|---|
| R1 mechanical/low risk | GPT-5.6 Luna, high | Approved copy/labels, selectors, narrow wiring, screenshot references, repetitive rename, known bounded UI correction | Independent GPT-5.6 Sol, medium |
| R2 normal cohesive feature | GPT-5.6 Terra, medium | One established workflow, ViewModel/state holder, adaptive UI, category/tag management, reproduced bounded defect | Independent GPT-5.6 Sol, medium |
| R3 data/financial/security/protocol/migration/cross-module | GPT-5.6 Terra or Sol, medium, with recorded complexity rationale | Persistent data, provider/server/client atomicity, replay/concurrency, migration/recovery, difficult diagnosis | Dedicated GPT-5.6 Sol, medium plus risk-specific evidence |
| Exceptional R3 | GPT-5.6 Sol, high | Severe or novel financial, migration/recovery, protocol, or security problem | Separate Sol review and owner-visible rationale for high effort |

Luna is never the primary builder for finance math, migrations, provider/auth,
cryptography, ambiguous concurrency, or new architecture. Escalate a builder
only after one bounded failed attempt and a coordinator explanation.

## Builder topology

Assign **one builder** when work shares state, repository/file ownership,
dependent contracts, or one end-to-end behavior. Assign parallel builders only
when each has a complete ready record, non-overlapping ownership, no unfinished
dependency, meaningful standalone tests, and a real wall-time benefit.

Serialize dependency work in this order: contracts/schema, data, state/wiring,
UI, tests/artifacts, documentation. A shared schema, migration, navigation,
build file, or interface has exactly one owner at a time.

## Monitoring and review

Tasks announce start, material progress, blockers, and completion to the
orchestrator. They do not expand scope or remain silently running; they stop and
report before 60 minutes of continuous work. The orchestrator responds with an
unblock, narrowed task, owner decision, or explicit continuation.

Every implementation receives an independent Sol review. The reviewer freezes
the exact commit/head and returns **PASS** or **BLOCK** with actionable P1/P2
findings and the smallest coherent repair. Findings go to the original builder;
the builder reruns focused evidence and the same reviewer rechecks the exact new
head. An unavailable independent Sol reviewer is an owner-decision stop, not a
silent downgrade.

One reviewer may review several bounded R1/R2 branches that form one coherent
release and share useful context. Use separate reviewers for R3 work, distinct
risk boundaries, independently mergeable work, large changes, or real parallel
review benefit. Add a combined integration review only when individually correct
branches can interact incorrectly, such as schema plus restore, repository plus
UI, server plus client acknowledgement, or navigation plus recreation.

## Integration, completion, and approvals

The orchestrator integrates only exact clean, reviewer-approved commits in
dependency order. It may merge or cherry-pick conflict-free commits. Production
conflicts go to a dedicated integration worktree, followed by Sol review of the
combined diff.

Run one proportional combined gate after integration: applicable compile, unit,
instrumentation, migration/recovery, screenshot/accessibility, explicit-serial
emulator, privacy, and secret scanning evidence. Owner/device acceptance remains
required for physical Vivo/OEM/fold feel, real providers, biometrics,
performance feel, private data, material product choice, or subjective final UX.
Deployment, release, installation, and external communication remain separate
owner approvals.

Close by updating the roadmap/issues/changelog/decision records, preserving only
sanitized evidence, closing/archiving tasks and worktrees, and reporting the
exact integrated commits, evidence, rollback, limitations, and next slices.
