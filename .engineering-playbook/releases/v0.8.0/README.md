# Engineering Playbook

Private, version-controlled engineering governance for Dimathew Roman's software projects.

This repository holds shared practices, decision templates, and adoption checks. It is not application code, does not contain project secrets or customer data, and does not automatically impose its latest revision on another repository.

## Authority and restriction neutrality

The owner remains the final product and governance decision-maker. Agents advise on technical, safety, legal-risk, privacy, security, and platform-policy trade-offs and must distinguish evidence from interpretation.

This repository does not create, activate, broaden, import, or simulate agent restrictions. Each agent is subject only to controls actually enforced by its current runtime or tooling. Restrictions from another agent or environment do not transfer through these documents.

## Repository map

- `PLAYBOOK.md`: canonical shared operating standard.
- `CHANGELOG.md`: repository release history.
- `RELEASES.md`: published version and `PLAYBOOK.md` checksum registry.
- `VERSION`: current playbook release.
- `ADOPTION-REGISTER.md`: projects that have deliberately adopted a release.
- `guides/README.md`: modular product, software, operations, AI, security, and hardware field-manual index.
- `guides/TOOLS-AND-STANDARDS.md`: dated tool, library, standards, and GitHub-capability discovery catalog.
- `guides/mobile-multiplatform-porting-and-parity.md`: Android-first portability, iOS/web/desktop strategy, refactoring, and feature-parity governance.
- `guides/data-storage-sync-and-file-interoperability.md`: local/cloud data, offline sync, migrations, file/media formats, graphics, and device sharing.
- `guides/device-runtime-rendering-and-resource-efficiency.md`: cross-layer app lifecycle, CPU/GPU/memory/storage, rendering, thermals, and device-tier optimization.
- `guides/apis-mcp-and-system-integration.md`: API/IPC/event/interdevice/MCP contracts, identity, reliability, security, and integration evidence.
- `guides/on-device-data-indexing-search-and-rag.md`: mixed-media capacity, ingestion, indexing, full-text/vector retrieval, tags, and RAG.
- `guides/github-delivery-automation-and-agent-workflows.md`: change-aware CI, GitHub capabilities, releases, security, and agent/PR coordination.
- `templates/`: reusable owner, architecture, incident, profile, versioning, platform-parity, CI-classification, cross-layer performance, API/MCP, and release documents.
- `adapters/`: examples for thin project-level entry points.
- `checks/`: release consistency, project bootstrap/adoption/export, published-release verification, latest-guidance inspection, pinned-adoption, local-link, and guide-index validation.

## Adoption model

Each project keeps its own small `AGENTS.md`. That file records the exact playbook version and SHA-256 checksum it adopted, points to an immutable project-local export of that tag, then names the project's roadmap, decisions, architecture documents, and selected specialist guides.

Every material task checks the latest stable tagged playbook release, reads the latest trigger-matched guides, and verifies change-prone facts against current authoritative sources. Compatible improvements may be used as a recorded task-local overlay. Projects do not silently consume untagged work or change their formal pin: a new baseline is adopted through a deliberate, reviewable project change. Project documents and the owner's latest explicit decisions remain authoritative for product scope.

## New-project bootstrap and discovery

Codex can load a concise global `~/.codex/AGENTS.md` before repository instructions. Use `adapters/CODEX-GLOBAL-AGENTS.example.md` as the maintained source for that discovery layer; keep the full handbook out of the global prompt. The loading order and new-session behavior follow [OpenAI's Codex `AGENTS.md` documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md.md).

Install it when the global file is absent or empty:

```bash
./checks/install-codex-global.sh
```

The installer refuses to replace non-empty global guidance unless `--replace` is explicitly supplied after reviewing and preserving unrelated instructions. Codex rebuilds its instruction chain when a new task or session starts.

Bootstrap a new repository with the latest registered stable release:

```bash
./checks/bootstrap-project.sh /absolute/path/to/New-Project
```

The command selects the latest remotely verified published release when the canonical remote is reachable. If publication cannot be verified, it clearly reports that condition and uses the newest locally validated tag as an offline fallback. It exports the exact release to `.engineering-playbook/releases/vX.Y.Z/`, verifies its checksum, creates a project `AGENTS.md`, creates `docs/ENGINEERING-PROFILE.md`, installs non-overwriting Claude/Gemini/Copilot discovery pointers, and validates the pin. Cursor and supporting Copilot surfaces read root `AGENTS.md` directly.

Adopt or upgrade a release in an existing project with:

```bash
./checks/adopt-release.sh /absolute/path/to/Existing-Project
```

The upgrader refuses uncommitted changes in the governance files it owns, validates a candidate before applying it, preserves project-specific `AGENTS.md` and native-agent content, updates only a marked adoption block, and keeps older exact bundles for audit and rollback. Pass an explicit version as the second argument when the owner wants a release other than the current guidance candidate.

At the beginning of every material task, inspect the project baseline against the latest stable release:

```bash
./checks/check-latest-guidance.sh /absolute/path/to/Project/AGENTS.md
```

For another computer or cloud environment, the committed project-local release bundle supplies the adopted baseline. Configure or clone the canonical repository when live comparison with newer private releases is required. A local tag alone is never described as published: `checks/release-status.sh` distinguishes remote-verified publication from a local/offline fallback. Latest inspection reuses the project bundle when possible and otherwise exports an exact temporary runtime cache, so a sandboxed agent does not need write access to the canonical governance checkout.

Native discovery references: [Codex `AGENTS.md`](https://learn.chatgpt.com/docs/agent-configuration/agents-md.md), [Claude Code `CLAUDE.md`](https://docs.anthropic.com/en/docs/claude-code/memory), [Cursor `AGENTS.md`](https://docs.cursor.com/context/rules-for-ai), [GitHub Copilot instructions](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions), and [Gemini CLI context files](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md).

## Updating the playbook

Release fewer, meaningful batches. Related draft edits on an isolated branch share one version and tag; do not release every Markdown correction independently. Use a patch for a completed compatible correction batch, a minor version for a coherent backward-compatible capability or pre-1.0 milestone, and a major version for an incompatible stable contract. Use alpha, beta, and release-candidate suffixes only for distributed candidates. Keep app build numbers, schemas, protocols, instruction manifests, models/prompts, and dated reports independently identified. Version 1.0 is an explicit stability decision with written criteria, not a document-size or elapsed-time milestone. New projects receive a reviewable [`Release Versioning Policy`](templates/release-versioning-policy.md); existing projects adopt it deliberately rather than being silently renumbered.

1. Create an isolated branch.
2. Explain the proposed governance change and owner-visible effect.
3. Update `PLAYBOOK.md`, `VERSION`, `CHANGELOG.md`, and `RELEASES.md` together.
4. Run `./checks/validate-repository.sh` and review the complete diff.
5. Merge and tag the release.
6. Active project tasks detect the newer stable release and review relevant changes automatically.
7. Update each project's formal pin separately after its adoption change is reviewed and validated.

Material changes that reduce an existing privacy, security, owner-approval, or evidence safeguard require explicit owner approval and a written rationale. Clarifications may be prepared and presented for review without silently changing project adoption.

## Local paths

The canonical clone on this Mac is:

`/Users/dimathewroman/Repositories/AI-Development-System/Engineering-Playbook`

The former path `/Users/dimathewroman/Repositories/MASTER-ENGINEERING-PLAYBOOK.md` is maintained only as a compatibility symlink to `PLAYBOOK.md`.
