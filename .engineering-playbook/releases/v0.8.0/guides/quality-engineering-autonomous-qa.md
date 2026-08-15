# Quality Engineering and Autonomous QA

Status: Supplementary practice module. Adopt it deliberately and scale it to the project's operating mode and risk.

Quality engineering builds fast, trustworthy feedback. It does not mean maximizing test count, automation, or code coverage. The owner defines acceptable product outcomes and residual risk; agents and engineers design evidence that makes those decisions informed.

## Start from promises and risks

For each material change, translate acceptance criteria into a verification matrix:

> Promise -> failure mode -> prevention or detection -> automated evidence -> live evidence -> retained result

Prioritize boundaries where failure could lose data, mislead a user, expose private information, block recovery, or create an expensive regression. A line with no meaningful failure does not need a test merely to raise coverage.

Use the [Quality and Verification Plan](../templates/quality-and-verification-plan.md) for R2/R3 work or any cross-cutting release.

## Autonomous QA loop

An authorized agent may run this loop without transferring routine technical choices to the owner:

1. Read the authoritative behavior, risk tier, supported environments, and known baseline failures.
2. Reproduce or observe the current state before changing a regression.
3. Build the smallest verification matrix that covers the important promises and failures.
4. Validate the test harness with a known-good and, when practical, a known-bad case.
5. Run cheap deterministic checks first, then integration, UI/system, device/browser, performance, and recovery checks as risk requires.
6. Classify failures as product regression, pre-existing baseline, test defect/flakiness, environment failure, or unresolved.
7. Diagnose the failing layer. Do not repeatedly rerun a nondeterministic test until it passes.
8. Fix within the authorized product direction, rerun targeted checks, then run the combined gate.
9. Review artifacts for privacy and retain only evidence needed for the decision.
10. Report what was verified, what remains uncertain, deviations, and the next action.

The loop does not expand authority. A new product direction, sensitive-data access, external release, weakened safeguard, or other owner gate remains a decision even when an agent can technically execute it.

For R3 or otherwise consequential work, separate implementation ownership from acceptance-oracle and review ownership when possible. A reviewer should challenge the invariants, harness, negative cases, evidence, and claimed result rather than only rerun the author's commands. If an independent reviewer is unavailable, use a deliberately separate review pass, known-bad or negative controls, mutation or differential evidence where useful, and record the independence limitation.

## Test portfolio

Select complementary evidence:

- Static analysis, type checks, formatting, dependency and secret checks.
- Unit, property, model-based, and invariant tests for deterministic logic.
- Contract and compatibility tests for APIs, schemas, events, files, and protocols.
- Persistence, migration, import/export, backup/restore, and corruption tests.
- Component and UI behavior tests, including semantics.
- Journey tests across real process, service, browser, or device boundaries.
- Visual regression with reviewed baselines.
- Fuzz, differential, mutation, fault-injection, load, soak, and recovery tests when their risk warrants them.
- Exploratory testing for behavior whose quality or novelty is not captured by an oracle.

Prefer many fast, isolated checks that do not depend on uncontrolled external state and a smaller number of expensive end-to-end journeys. Do not mock away the boundary whose behavior is the purpose of the test. The expected-result rule or model is the **test oracle**; identify who owns it when correctness depends on product or domain judgment.

## Determinism and controllability

Reliable tests control or record:

- Random seeds.
- Clock, timezone, locale, and calendar.
- Network latency, loss, reordering, duplication, and offline state.
- External-service responses and versioned contracts.
- Storage capacity, permissions, process lifecycle, and resource pressure.
- Test identities, data setup, and cleanup.
- Toolchain, build mode, device/browser version, and configuration.

Use dependency injection, fake clocks, local fixtures, simulators, containers, or virtual services where they clarify causality. These are examples, not required tools. Maintain at least one appropriate real-boundary check so a convincing fake cannot hide integration failure.

## Test data and privacy

- Use synthetic factories and minimized fixtures by default.
- Give fixtures stable identities and document what condition each represents.
- Keep production credentials and private data out of CI, prompts, screenshots, recordings, logs, and golden files.
- If task-specific authorization permits private data, isolate the minimum excerpt, prevent persistence into source or telemetry, and remove temporary copies after verification.
- Test redaction and deletion rather than assuming them.

## Test-code quality

Tests are production assets:

- Assert behavior and invariants, not incidental implementation detail.
- Make failure output identify expected state, actual state, environment, and reproducible seed or case.
- Keep setup legible and shared helpers narrow.
- Avoid sleeps when a state/event can be awaited.
- Avoid global mutable fixtures and order dependence.
- Review generated snapshots and goldens; an update is a product decision when it changes visible behavior.
- Delete tests only when the promise no longer exists or equivalent evidence replaces them.

Changing a test to make a failure disappear is not a fix. Record the changed contract or explain why the prior oracle was wrong.

## Flakiness and harness failures

Treat nondeterminism as a defect in the delivery system.

- Capture frequency, environment, seed, timing, and suspected shared state.
- Quarantine only with an owner, issue, narrow scope, and expiry.
- Preserve a non-blocking signal while quarantined when practical.
- Track time-to-repair and prevent an expanding quarantine list.
- Distinguish product intermittency from test intermittency; both may be real defects.

## Visual and live evidence

For visible or system-dependent behavior, record enough context to reproduce the evidence:

- Commit/build identity and configuration.
- Device/browser, OS, window size, theme, locale, text scale, and accessibility settings.
- Starting state, input steps, expected behavior, and result.
- Screenshot for static layout, recording for motion/interaction, and trace for timing/causality.

A screenshot cannot prove delivery, persistence, responsiveness, accessibility semantics, or killed-process recovery.

## Continuous quality gates

Use risk-based gates rather than one universal pipeline:

- Pull request: fast deterministic checks and change-focused evidence.
- Integration: combined app, contracts, migrations, and selected journeys.
- Release candidate: representative artifact, device/browser matrix, performance, security/privacy, rollback and restore.
- Canary/production: approved privacy-safe health signals and explicit stop/promote criteria.

Track gate duration, flake rate, escaped defects, time to detect, and time to repair only when those metrics drive action. Optimize the feedback loop without deleting meaningful evidence.

### Change-aware CI

Every maintained repository should define semantic change classes and the smallest truthful gate for each. Use the [CI Change-Classification Plan](../templates/ci-change-classification-plan.md) for repositories with materially different product, governance, documentation, dependency, infrastructure, or release work.

- Keep a cheap classifier/summary job running for every pull request so required-check status is always reported and explainable.
- Route by affected behavior and build inputs, not file extension alone. A Gradle wrapper, shared schema, CI workflow, code generator, or signing change may require an app build even if no application source file changed.
- Pure handbook/documentation/template changes should run link, schema, secret, policy, and repository validators—not unrelated device matrices or application compilation—unless the changed file can affect generated/runtime output.
- Make classifier and workflow changes conservative: run the fuller gate when classification is unknown, disputed, or itself modified.
- Preserve scheduled/merge-queue integration, explicit full-test dispatch, release-candidate gates, and a label/input override so change-focused pull-request feedback cannot become the only integration evidence.
- Publish the selected class, reasons, jobs run/skipped, duration, and override in the check summary. Audit p50/p95 duration, queue time, flakes, skips, cost, and escaped regressions.

GitHub job-level conditions can keep an always-present workflow/check while marking irrelevant jobs skipped; repository rules and required-check behavior must be tested in the actual repository. See [GitHub Delivery, Automation, and Agent Workflows](github-delivery-automation-and-agent-workflows.md).

## Useful references

- [Google Testing Blog: Test Sizes](https://testing.googleblog.com/2010/12/test-sizes.html) describes a practical speed and scope classification; it is an example, not a mandated taxonomy.
- [Android testing guidance](https://developer.android.com/training/testing) provides platform-specific layers and tools.
- [W3C WCAG 2.2 techniques](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques.html) are informative techniques; conformance rests on applicable success criteria, not a particular tool.
