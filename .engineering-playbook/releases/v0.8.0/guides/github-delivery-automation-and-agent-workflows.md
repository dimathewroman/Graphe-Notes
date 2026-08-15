# GitHub Delivery, Automation, and Agent Workflows

Use this guide when a repository relies on GitHub for version history, issues, pull requests, CI/CD, releases, security, packages, development environments, or coding agents.

GitHub is a product family, not only remote Git storage. Select capabilities from the repository's risk, scale, plan, privacy, and operator needs; verify current availability and pricing before relying on a feature in a private repository.

## Repository foundation

For a maintained product, consider:

- Issues, labels, milestones, Projects, templates, linked branches, and a decision/evidence trail.
- Pull requests, draft state, CODEOWNERS, review ownership, suggested changes, auto-merge or merge queue where useful.
- Branch/tag rulesets or protected branches with proportional required checks and force-push/deletion controls.
- Actions for validation, builds, device/browser tests, artifacts, deployment, releases, maintenance, and scheduled checks.
- Releases, immutable tags where supported, changelogs, signed/checksummed artifacts, packages/containers, and provenance/attestations where available.
- Dependency graph, Dependabot alerts/updates, dependency review, CodeQL/code scanning, secret scanning/push protection, security policy/advisories, and least-privilege tokens.
- Environments for staging/production secrets, approval, allowed branches, and deployment history.
- Codespaces/dev containers for reproducible cloud development when their cost and Linux/container boundary fit.
- GitHub Pages for appropriate public static documentation—not private application secrets or a substitute for an authenticated backend.
- Copilot instructions, code review, coding agent/custom agents, skills/plugins/MCP, and repository tools where enabled and useful.

Not every feature is included for every account, plan, region, repository visibility, or organization. Record unavailable controls and a compensating process; never claim a feature is active merely because GitHub documents it.

## Design CI from change semantics

The slowest credible pipeline should not run for every diff. Define stable classes such as:

| Class | Typical changes | Default evidence |
|---|---|---|
| Governance/docs | Markdown, playbook bundle, templates, non-executable policy | Link/schema/pin/secret checks; no app compile |
| Tooling/tests only | Test code, scripts, fixtures, lint rules | Tool self-tests and affected source validation; package build only if the tool changes packaging |
| Product source | UI, domain, data, networking, native code | Targeted unit/static/integration checks and affected platform build |
| Dependency/build/protocol | Lockfiles, manifests, Gradle/Xcode/native toolchain, schemas/protocols, CI build logic | Full affected builds, compatibility/security checks, and stronger fail-closed routing |
| Release/deployment | Signing, distribution, migrations, production config | Identified artifact, release matrix, protected environment, rollout/rollback gates |

Classify by both path and semantic risk. A one-line signing, permission, migration, or financial change may be heavy; a seven-thousand-file immutable documentation bundle may remain governance-only.

### Required classifier pattern

- Keep one small, always-running classifier/integrity job with narrow permissions.
- Diff against the actual pull-request base/head and handle renamed/deleted/empty/ambiguous results.
- Emit explicit outputs such as `validate_source`, `build_android`, `build_apple`, `run_device_matrix`, and `release_candidate` plus a human-readable reason.
- Gate jobs with job-level `if` conditions. GitHub documents skipped jobs as successful, including when the check is required.
- Prefer this stable required-check name over a required workflow that disappears through event-level path filtering; GitHub warns that path-filtered required workflows can remain pending.
- Treat changes to the classifier, workflow, dependency graph, build/signing pipeline, or unknown paths as full or appropriately expanded validation until the new gate proves itself.
- Add table-driven classifier tests containing positive, negative, mixed, rename/delete, draft, label override, base failure, and empty-diff cases.
- Allow a reviewed `full-ci` label/manual dispatch for escalation, never an unreviewed label that weakens gates.
- Run integration-branch and release-candidate gates independent of PR fast paths so individually safe skips cannot hide combined breakage.

Every CI job should have a timeout, concurrency/cancellation policy, minimal token permissions, bounded artifacts/log retention, dependency cache key, and diagnostic reason for running or skipping.

## Make feedback fast without making it hollow

1. Run format/type/unit/classifier checks first and in parallel where independent.
2. Cache dependencies and immutable compilation inputs; do not cache untrusted outputs into privileged jobs.
3. Split validation from packaging. A source test should not rebuild a release APK/IPA unless packaging evidence is required.
4. Use matrices only for meaningful variability. A full OS/device/browser matrix belongs at integration/release cadence unless risk requires it on the PR.
5. Shard long deterministic suites; identify and repair overhead before buying more runners.
6. Upload only useful failure/release evidence and set retention. Large artifacts and logs consume time, storage, money, and privacy budget.
7. Measure queue time, setup time, useful test time, cache hit rate, total duration, cancellation, flake rate, and cost per accepted change.
8. Set feedback budgets—for example, governance under one minute after scheduling, ordinary PR signal within several minutes, and separately bounded release/device gates.

Do not optimize CI by deleting the only test that proves a material promise. Move it to the correct gate and preserve when/why it runs.

## Reuse and maintain workflows

- Use composite actions for reusable step sequences and reusable workflows for governed job/workflow contracts.
- Pin third-party actions to reviewed full commit SHAs with a version comment. Review updates and permissions.
- Keep generated build scripts testable locally where practical; CI YAML should orchestrate rather than hide all logic in shell fragments.
- Centralize toolchain versions and dependency caches without creating a single high-privilege workflow that every untrusted PR can influence.
- Prefer GitHub's short-lived `GITHUB_TOKEN` with explicit permissions or OIDC federation over long-lived cloud credentials.
- Never expose privileged secrets to fork/untrusted PR code or use `pull_request_target` to check out and execute untrusted head code.

## Pull requests and agent-assisted delivery

A coordinating agent should treat Git/GitHub mechanics as implementation detail the owner need not micromanage, subject to the current runtime's actual capabilities and authority.

When the current agent runtime permits delegation and the work contains two or more genuinely independent bounded outcomes, the coordinator should consider subagents without waiting for the owner to name the technique. Do not delegate merely to appear parallel, and do not claim unavailable tools.

Effective agent PR pattern:

1. Coordinator reads authority, defines acceptance, risk, dependency graph, files, and integration base.
2. Independent research, test design, platform spikes, or review can run concurrently with bounded artifacts.
3. Mutable implementation uses exclusive file/module ownership or isolated worktrees. Shared schemas, lockfiles, build workflows, navigation, and migrations have one owner at a time.
4. Coordinator reviews actual diffs and evidence, rebases/merges dependency-first, and runs the combined gate.
5. Open a draft PR early when hosted checks or review visibility add value; keep description/evidence current.
6. Use focused review agents for security, data migration, accessibility, performance, platform parity, or test-oracle challenge—never majority vote as correctness.
7. Address review threads explicitly, re-run only affected failures when supported, and classify baseline/flaky/infrastructure failures honestly.
8. Enable auto-merge or merge queue only after gates and authority are satisfied; verify the merged commit and integration branch.

Agents should use GitHub APIs/apps/CLI for issues, PRs, checks, artifacts, releases, and comments when available instead of scraping UI. External writes, merges, releases, spending, or communications still follow owner/project authorization.

## GitHub Actions mobile topology

- Linux runners: portable logic, Kotlin/JVM, JavaScript/TypeScript, Android unit/static checks, and most Android builds.
- macOS runners: Xcode, iOS/iPadOS/macOS builds, simulators, signing preparation, and Apple tests. Use only when Apple/shared-boundary inputs require them.
- Device farms: separate workflow/reusable workflow after an artifact exists; select a small risk-based matrix and preserve artifact/build identity.
- Protected release jobs: signing, TestFlight/App Store/Play upload, notarization, and production deployment through environments with scoped credentials and approval where required.
- Reusable artifact: build once, attest/checksum, test/promote the same artifact where channel mechanics allow.

## Security and supply chain

- Keep workflow permissions explicit and minimal; review actions, containers, scripts, and transitive download behavior.
- Enable available dependency/security features proportionally, but triage results rather than treating scanners as proof.
- Use dependency review for lockfile/manifests, CodeQL/static scanning where supported, secret scanning/push protection, and SBOM/provenance for consequential distributed artifacts.
- Protect branch/tag/release identities. Restrict who or what can publish packages/releases and preserve revocation/rotation procedures.
- Treat Actions caches and artifacts as data boundaries. Do not place secrets or private production contents in them; guard against cache poisoning and artifact substitution.

## Capability audit cadence

Quarterly and after a material GitHub plan/product change, review:

- Which repository, issue/project, Actions, Codespaces, Packages, Pages, release, security, Copilot/agent, and API capabilities are available and actually enabled.
- Which checks are required, median/p95 duration, cost, duplicate work, skips, queue delay, flakes, and escaped regressions.
- Rulesets/branch protection, environment secrets, workflow permissions, installed GitHub Apps, deploy keys/tokens, webhooks, runners, and stale access.
- Whether a new built-in capability safely replaces bespoke automation, or whether a feature became unavailable/paid/deprecated.

## Completion evidence

- Repository capability inventory with plan/availability and chosen/not-applicable rationale.
- CI classification table, tested classifier, feedback budgets, and full integration/release fallback.
- Required-check/ruleset map and least-privilege workflow review.
- Agent/worktree/PR ownership model.
- Release artifact identity, provenance/checksum, environment, promotion, rollback, and retention plan.

## Official starting points

- [GitHub Actions: choosing when workflows run](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run)
- [GitHub Actions job conditions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions)
- [Reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)
- [GitHub security features](https://docs.github.com/en/code-security/getting-started/github-security-features)
- [Repository rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [GitHub Codespaces and dev containers](https://docs.github.com/en/codespaces/setting-up-your-project-for-codespaces/adding-a-dev-container-configuration/introduction-to-dev-containers)
- [GitHub Copilot custom instructions](https://docs.github.com/en/copilot/reference/custom-instructions-support)
- [GitHub Copilot plugins](https://docs.github.com/en/copilot/concepts/agents/about-plugins)
