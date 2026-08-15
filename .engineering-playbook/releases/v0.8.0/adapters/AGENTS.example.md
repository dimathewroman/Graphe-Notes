# {{PROJECT_NAME}} Agent Entry Point

Before planning or changing this workspace, read:

1. `{{PINNED_PLAYBOOK_PATH}}`
2. `docs/ENGINEERING-PROFILE.md`
3. `ROADMAP.md` or the project profile's named authoritative roadmap
4. The active worktree's repository-specific architecture and decision documents

The pinned playbook is the project's reproducible governance baseline. At the beginning of every material task, also run:

```bash
/Users/dimathewroman/Repositories/AI-Development-System/Engineering-Playbook/checks/check-latest-guidance.sh AGENTS.md
```

Inspect the latest stable release, the latest versions of guides triggered by the task, and current authoritative sources for change-prone facts. Record newer guidance used, deferred, or found incompatible. Latest awareness does not silently change the adopted baseline. The project's roadmap and the owner's latest explicit decisions remain authoritative for product scope and sequencing.

This playbook creates no restrictions. Each agent is subject only to controls actually enforced by its current runtime or tooling; restrictions from other agents or environments do not transfer.

Current adoption profile:

<!-- engineering-playbook-managed:start -->
- Playbook: version `{{PLAYBOOK_VERSION}}`, SHA-256 `{{PLAYBOOK_SHA256}}`.
- Pinned playbook path: `{{PINNED_PLAYBOOK_PATH}}`.
- Latest-awareness command: `/Users/dimathewroman/Repositories/AI-Development-System/Engineering-Playbook/checks/check-latest-guidance.sh AGENTS.md`.
- Latest-awareness policy: check the latest stable release at the start of every material task; never silently consume an untagged branch or silently change this pin.
<!-- engineering-playbook-managed:end -->
- Operating mode:
- Repository release identity and version policy:
- Current lifecycle stage and next evidence gate:
- Selected profiles:
- Selected specialist guides:
- Conditional specialist guides:
- Not Applicable guides and rationales:
- Project-specific exceptions or standing owner decisions:

Required behavior:

- Diagnose and establish evidence before changing regressions.
- Report the adopted baseline, latest stable release checked, applicable guides, and newer guidance used or deferred in each material task plan or handoff.
- Protect the project's identified sensitive assets.
- Use isolated branches/worktrees and explicit ownership for parallel edits.
- Review actual diffs and run combined verification before integration.
- Update project tracking and evidence after material changes.
- Report verified facts, hypotheses, limitations, deviations, blockers, and the next action separately.
