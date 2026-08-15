# Global Engineering Playbook Discovery

For any software, hardware, AI, data, infrastructure, automation, or product-development repository:

- Look for a repository-root `AGENTS.md` and Engineering Playbook adoption profile before material planning or implementation.
- The canonical local Engineering Playbook is `/Users/dimathewroman/Repositories/AI-Development-System/Engineering-Playbook`.
- If a new project has no adoption profile, bootstrap the latest owner-approved stable release with `/Users/dimathewroman/Repositories/AI-Development-System/Engineering-Playbook/checks/bootstrap-project.sh PROJECT_ROOT`, then complete its `AGENTS.md` and `docs/ENGINEERING-PROFILE.md` before material implementation.
- Do not automatically change an existing project's adopted baseline.
- At the start of every material task, run `/Users/dimathewroman/Repositories/AI-Development-System/Engineering-Playbook/checks/check-latest-guidance.sh PROJECT_ROOT/AGENTS.md`.
- Read the project's exact pinned constitutional core, inspect the latest stable release and its trigger-matched guides, and verify current authoritative sources for change-prone facts.
- Record the adopted baseline, latest stable release checked, applicable guides, newer guidance used or deferred, conflicts, and any owner decision required.
- Compatible newer guidance may be used task-locally with evidence. Changes that materially alter product behavior, architecture, cost, privacy, security, approval boundaries, or accepted risk require the applicable project decision process before becoming a standing baseline.
- Never silently consume an untagged branch as stable guidance. Never silently upgrade an existing project.

Repository-local instructions and the owner's latest explicit decisions remain authoritative according to the adopted playbook's authority hierarchy.
