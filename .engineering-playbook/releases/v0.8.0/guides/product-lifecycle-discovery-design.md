# Product Lifecycle, Discovery, and Design

Status: Supplementary practice module. A project adopts this guide deliberately through its engineering profile or project instructions.

This guide helps a team move from an uncertain opportunity to a supported product and, eventually, an orderly retirement. It does not choose the product roadmap. The owner's explicit decisions and the project's authoritative product documents remain controlling.

## Use the smallest lifecycle that fits

Treat product development as a learning loop:

> Discover -> define -> design -> build -> verify -> release -> operate -> learn -> scale, change, or retire

The stages may overlap. A small private tool may record them in one page; a consequential public service may need separate briefs, reviews, and evidence. Do not perform ceremony that cannot change a decision.

For each active stage, record:

- The question being answered.
- Current verified evidence and important uncertainty.
- The decision owner.
- The cheapest evidence that could change the decision.
- The exit, stop, or revisit condition.
- The artifact that becomes authoritative after the decision.

## Discovery: earn the right to build

Start with the problem rather than a preferred implementation.

1. Identify the people, situation, frequency, current workaround, and consequence of the problem.
2. Separate reported preference from observed behavior. Both are evidence, but they answer different questions.
3. Describe the desired outcome without assuming a feature or technology.
4. State non-goals and the people or situations the first version will not serve.
5. Map assumptions by consequence and uncertainty. Test the assumptions that could invalidate the product before polishing low-risk details.
6. Compare existing products, adjacent fields, platform capabilities, standards, and prior failed approaches. Record what is observed, inferred, or still unknown.
7. Define the smallest falsifiable test: interview, task observation, paper prototype, technical spike, concierge workflow, or instrumented prototype.

For research with people, explain the purpose and recording/data use, obtain appropriate informed consent, recruit accessibly and as representatively as practical, minimize notes and recordings, protect sensitive disclosures, define incentives fairly, and set retention/deletion. Work involving minors, vulnerable participants, health/financial distress, workplace power, deception, or publication may warrant specialized ethical or legal review.

Avoid asking only whether someone likes an idea. Prefer questions and observations about recent behavior, real constraints, trade-offs, and what the person already does.

Discovery is sufficient when the owner can decide whether to stop, investigate further, or fund a defined outcome. It is not required to remove all uncertainty.

## Product brief

Before sustained delivery, keep one authoritative brief that states:

- User and problem.
- Evidence and unresolved assumptions.
- Intended outcome and observable success measures.
- Core journeys and experience principles.
- Scope, non-goals, operating mode, and supported platforms.
- Sensitive data, trust boundaries, business model, and cost constraints.
- Dependencies and differentiating capability.
- Release hypothesis and reasons to stop or pivot.
- Owner decisions and review triggers.

Do not let multiple pitch decks, issues, chats, and prototypes become competing product definitions.

## Design the whole state space

Design is more than the successful screenshot. For every important journey, describe:

- Entry points, prerequisites, and permissions.
- Primary path and meaningful alternatives.
- Loading, empty, partial, stale, offline, retry, and unavailable states.
- Validation, errors, destructive actions, cancellation, undo, and recovery.
- Backgrounding, interruption, restart, and cross-device or cross-window continuation where applicable.
- Accessibility, localization, large content, reduced motion, keyboard, pointer, touch, and assistive-technology behavior.
- Data freshness, privacy, cost, and user control that must be visible.
- Completion, confirmation, and what happens next.

Use the [UI State and Journey Matrix](../templates/ui-state-and-journey-matrix.md) for journeys whose missing states could cause confusion, loss, or inaccessible behavior.

## Prototype by question

Choose prototype fidelity based on the uncertainty:

| Question | Useful evidence |
|---|---|
| Is the problem real? | Interview, observation, diary, support evidence |
| Is the flow understandable? | Paper or clickable prototype and task-based usability session |
| Is the interaction delightful? | High-fidelity motion or device prototype |
| Is the platform capability possible? | Isolated technical spike with measured constraints |
| Is the architecture viable? | Walking skeleton through the riskiest boundary |
| Will people return or pay? | Realistic pilot, concierge test, or approved limited release |

A prototype proves only the question it was built to answer. Do not infer production reliability, security, demand, or maintainability from a convincing demo.

## Design review

Review the experience before implementation locks in expensive assumptions:

- Can the intended user explain what the product is doing and why?
- Does the information hierarchy match the user's task rather than the storage model?
- Are important choices reversible or clearly confirmed?
- Are system status, uncertainty, delay, and failure visible without exposing internals?
- Are defaults safe and useful?
- Does the design work with realistic content and adverse states?
- Is accessibility built into interaction and content, rather than deferred to final QA?
- Does the experience follow platform conventions where convention helps, and diverge deliberately where the product benefits?

Record decisions that materially affect the product. Visual taste within an approved direction normally remains an implementation/design judgment; competing user-visible directions go to the owner with a plain-language recommendation.

## Build and verification handoff

A design entering delivery should provide:

- Acceptance criteria stated as observable behavior.
- A journey/state matrix for important paths.
- Authoritative copy, assets, tokens, and interaction references.
- Responsive and supported-platform expectations.
- Accessibility and localization expectations.
- Analytics or feedback requirements, if approved.
- Known open questions and who decides them.

Implementation discoveries feed back into the design. Do not silently change product behavior because a mockup omitted a hard state.

## Release, learning, and iteration

Before release, state what the release is expected to change for users and how the team will know. Combine:

- Correctness, reliability, performance, accessibility, and support evidence.
- Direct user feedback and observed usability.
- Product outcomes or local/approved analytics.
- Cost, maintenance, and operational load.
- New failure modes, exclusions, and unintended behavior.

Metrics are decision aids, not substitutes for judgment. Define the population, time window, exclusions, data quality, privacy basis, and decision threshold. New off-device telemetry still requires the approval and privacy gate in the master playbook.

After the monitoring window, decide explicitly: continue, expand, revise, roll back, hold, or retire. Record why.

## Support and retirement are product stages

Design supportability before users depend on the product: understandable errors, safe diagnostics, recovery paths, known limitations, and a route for feedback.

Before retiring a durable capability, plan:

- User notice and supported transition period.
- Export, migration, compatibility, and rollback window.
- Data retention and verified deletion.
- Billing, entitlement, integration, credential, and infrastructure shutdown.
- Final support, documentation, artifact, and decision-record preservation.

Retirement is complete only when user impact, data disposition, external dependencies, spend, and security exposure have been verified.

## Useful references

- [Google Research: HEART user-centered metrics](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/) maps product goals to signals and metrics.
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) and [Android app quality guidance](https://developer.android.com/docs/quality-guidelines/core-app-quality) are platform references, not substitutes for project-specific user evidence.
- [W3C Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/) provides normative web accessibility criteria; applicability and conformance claims require deliberate review.
