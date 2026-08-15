# Changelog

All notable repository-level changes are recorded here. Playbook releases use semantic-style version tags even when a release changes only governance text.

## 0.8.0 — 2026-08-15

- Added the canonical Adaptive Orchestrated Coding Delivery guide and task record for owner-approved model/risk routing, builder readiness, exclusive worktree ownership, 60-minute reporting, independent frozen-head review, remediation, integration, combined gates, and cleanup.
- Made the primary-orchestrator implementation boundary explicit for multi-role work while preserving a documented small single-agent exception path.
- Added structural validation so the guide, task record, model-availability stop, independent-review rule, and integration-worktree rule cannot silently disappear.

## 0.7.0 — 2026-08-09

- Established a shared semantic release language across playbooks, personal infrastructure, applications, services, libraries, and physical-system repositories without synchronizing their version numbers.
- Defined the meaning of pre-1.0 milestones and `alpha`, `beta`, and `rc` candidates; separated repository releases from platform build numbers, database schemas, APIs/protocols, file formats, instruction manifests, model/prompt revisions, and dated reports.
- Added a reusable Release Versioning Policy, expanded project engineering profiles and release checklists, and prepared new-project bootstrap to create a project-owned policy when the adopted release contains the template.
- Added repository validation for stable Semantic Versioning syntax and retained the slower meaningful-batch release rule.

## 0.6.0 — 2026-08-07

- Added dedicated Device Runtime/Rendering/Resource Efficiency, APIs/MCP/System Integration, and On-Device Data/Indexing/Search/RAG guides.
- Added Cross-Layer Performance and Capacity and API/MCP Integration templates; expanded the engineering profile, resource budget, interface record, guide routing, and tool catalog around them.
- Connected transistor/compute/memory/storage/cooling fundamentals, lifecycle/IPC, GPU/frame pipelines, wired/wireless layers, device tiers, mixed-media capacity, full-text/vector retrieval, tagging, and RAG to measurable product decisions.
- Strengthened AI provider/API credential and billing boundaries, model-independent task contracts, context/tool efficiency, dynamic tactics, and the continuous evidence-to-guidance learning loop.
- Adopted a slower release policy that batches related edits and reserves new tags for complete fixes or coherent capabilities rather than individual Markdown changes.

## 0.5.0 — 2026-08-07

- Added dedicated guides for mobile/multiplatform porting and feature parity, data/storage/sync/file interoperability, and GitHub delivery/automation/agent workflows.
- Added reusable Platform Portability and Parity and CI Change-Classification plans and routed them from the guide index, engineering profile, quality plan, and core checklists.
- Established an Android-first portability model with portable product truth, native platform experience, hardest-capability spikes, explicit parity classifications, and independent build/sign/test/release evidence per target.
- Added semantic change-aware CI so governance-only changes run focused repository validation instead of unrelated app compilation, with conservative unknown handling and preserved integration/release gates.
- Expanded current-runtime AI capability discovery, proactive bounded subagent coordination, isolated PR integration, GitHub capability/security review, SQLite/WAL and offline sync discipline, file/media/HEIC interoperability, and mobile GPU/testing guidance.

## 0.4.1 — 2026-08-07

- Fixed `checks/adopt-release.sh` so an existing engineering profile's canonical guide-index link advances to the adopted exact release instead of continuing to route agents to an older bundle.
- Added an adoption regression that verifies the managed pin and guide route move together.
- Kept multiple ambiguous guide routes fail-closed and preserved project-specific profile content.

## 0.4.0 — 2026-08-07

- Added a dedicated adaptive, responsive, and foldable engineering guide that separates durable product/workflow state from changing presentation and defines a continuity invariant across resize, rotation, fold/unfold, multi-window, recreation, and process death.
- Added an Adaptive Continuity Plan covering state ownership, composition, breakpoint boundaries, stateful transitions, combined configuration changes, effects/reconciliation, accessibility, performance, and representative physical-device evidence.
- Expanded the Android/foldable core profile, failure testing, feature/release checklists, engineering profile, experience QA, quality plan, UI journey matrix, and tool catalog so per-size screenshots cannot substitute for live continuity verification.
- Incorporated current official Android adaptive quality tiers and testing APIs plus Samsung and Flutter guidance and clearly labeled archived Microsoft dual-screen patterns without making device-specific layouts or named libraries mandatory.

## 0.3.6 — 2026-08-07

- Added safe existing-project migration for older `AGENTS.md` files whose playbook pin occupies an `## Adopted engineering standard` section rather than the standardized `- Playbook:` block.
- Added an OpenBubbles-shaped regression fixture proving that the obsolete pin section is replaced, the managed exact-release block validates, and the following project-specific behavior remains intact.
- Kept unknown legacy layouts fail-closed and changed the adopter's completion message to report the canonical Git project name in linked worktrees.

## 0.3.5 — 2026-08-07

- Fixed generated engineering-profile identity in linked worktrees by deriving the display name from Git's common repository rather than the temporary checkout directory.
- Fixed generated engineering-profile guide routing so it resolves to the adopted immutable bundle under `.engineering-playbook/releases/`.
- Added regression coverage for both worktree identity and the exact bundled guide-index link; consuming projects remain deliberately pinned.

## 0.3.4 — 2026-08-07

- Fixed `checks/adopt-release.sh` so its managed block supplies the latest-awareness command required by v0.3.1+ validation, including for custom legacy project entry points that never used the generated adapter.
- Added a Budgette-shaped regression fixture that verifies upgrade validation and preservation of project-specific instructions.
- Replaced a stale hard-coded latest-release test assumption with dynamic validated-tag discovery so post-tag validation does not fail merely because a new release exists.
- Kept adoption deliberate and pinned; this patch changes the updater but does not repoint any consuming project automatically.

## 0.3.3 — 2026-08-07

- Fixed fresh-process latest-guidance inspection so it does not require writing a redundant cache inside the canonical Engineering Playbook repository.
- Reused the project's exact bundle when it already matches the latest release and used an exact temporary runtime cache when another release must be inspected.
- Added regression coverage for the sandboxed fresh-project path exposed by the v0.3.2 acceptance test.

## 0.3.2 — 2026-08-07

- Added `checks/adopt-release.sh` for reviewable existing-project upgrades that preserve project-specific instructions, refuse overlapping dirty governance files, validate before applying, and retain immutable earlier releases.
- Added managed adoption blocks to the project adapter and engineering profile so future upgrades edit only canonical pin fields.
- Added `checks/release-status.sh` and changed bootstrap/latest inspection/export behavior to distinguish remotely verified published tags from locally validated tags and explicit offline fallback.
- Added non-overwriting Claude Code, Gemini CLI, and GitHub Copilot discovery adapters while retaining root `AGENTS.md` as the single substantive authority and documenting Cursor's native support.
- Expanded workflow tests for existing-project adoption, legacy migration, adapter preservation, and remote-versus-local release classification.

## 0.3.1 — 2026-08-07

- Introduced latest-aware, pinned-governed routing: every material task checks the newest validated tag and current authoritative sources while retaining an auditable adopted baseline.
- Allowed compatible newer guidance as an explicitly recorded task-local overlay while routing material product, architecture, cost, privacy, security, approval, or accepted-risk changes through the normal decision and adoption process.
- Added immutable tagged-release export and new-project bootstrap tooling so a pin resolves to exact files instead of whichever version the canonical working tree currently contains.
- Added a latest-guidance inspection command that verifies the project pin, reports the newest stable release, locates the project bundle, and summarizes changed guidance.
- Made latest inspection materialize an ignored canonical cache for an older adopter's exact tagged baseline when its project-local portable bundle has not yet been installed.
- Added a concise Codex-wide discovery template and strengthened the project adapter, engineering profile, guide-selection record, release checklist, readiness/done rules, and subagent briefs.
- Extended repository and adoption validation for the new scripts and v0.3.1 exact-release access contract.
- Added automated positive and negative workflow tests for bootstrap, export, global installation, latest inspection, existing-file preservation, and pinned-bundle tamper detection.
- Configured repository CI to fetch tagged history so release-export and latest-stable tests exercise real published tags on pull requests.
- Reconciled the adoption register with Budgette's confirmed v0.3.0 adoption in PR #15 while leaving unconfirmed project state unchanged.

## 0.3.0 — 2026-08-07

- Introduced a five-layer field-manual architecture: constitutional core, universal lifecycle, selected specialist guides, dated tool/standards catalog, and project-specific evidence.
- Added the Discover → Design → Build → Verify → Release → Operate → Learn → Scale or Retire lifecycle with explicit stages and evidence gates.
- Added twenty specialist guides spanning product/design/QA/accessibility/performance/operations/analytics/monetization/privacy/IP/supply chain/abuse, finance/compliance/cryptography/security research/frontier work/AI, software architecture/data/networking/platforms/languages, and hardware/OS/embedded/RF/sensing/robotics/CAD/manufacturing.
- Added a guide index and dated tool/library/standards/GitHub-capabilities catalog.
- Added eleven reusable quality, finance, frontier, recovery, systems, hardware, safety/compliance, and validation templates.
- Expanded the engineering profile and project adapter to select specialist guides, lifecycle stage, physical-system scope, support/recovery, and retirement expectations.
- Independently cross-reviewed and hardened R3 QA, secure updates, billing reconciliation, research consent/authorization, recovery/retirement, hardware/RF/battery safety, post-market response, and conformity-evidence boundaries.
- Added validation for local Markdown links and complete guide-index coverage.
- Made adoption validation tolerant of concise and line-wrapped registered version/checksum pins.
- Preserved deliberate pinned adoption: no consuming project automatically adopts v0.3.0, and each project pin remains separately managed and validated.

## 0.2.3 — 2026-08-07

- Corrected the default severity example so irreversible loss is consistently classified as S3.
- Added `RELEASES.md` and changed adoption validation to verify a project's deliberately pinned registered version rather than requiring the repository's current version.
- Aligned engineering-profile mode and profile names with the canonical playbook.
- Pinned the repository's GitHub Action to a reviewed full commit SHA and added validation that rejects floating major-branch action references.
- Distinguished the adopted `PLAYBOOK.md` checksum from the Git tag and commit that identify the complete governance release.

## 0.2.2 — 2026-08-07

- Established the dedicated private Engineering Playbook repository.
- Preserved the exact v0.2.1 playbook as the import commit and `v0.2.1` tag.
- Moved the canonical playbook path into this repository and retained the former path only as a compatibility symlink.
- Added owner-decision, engineering-profile, architecture-decision, incident-review, and release-checklist templates.
- Added a thin `AGENTS.md` adapter example, an adoption register, and repository/adoption validation.
- Confirmed that project adoption is deliberate and pinned rather than automatically following `latest`.

## 0.2.1 — 2026-08-07

- Clarified that the playbook does not create, activate, broaden, import, or simulate agent restrictions.
- Made runtime limitations specific to controls actually enforced in the current environment.
- Confirmed that restrictions from other agents, providers, models, sessions, or tools do not transfer.

## 0.2.0 — 2026-08-07

- Added the owner quick start, Owner Decision Brief, approval matrix, operating modes, proportional R0-R3 process, engineering profiles, and expanded verification and governance practices.
