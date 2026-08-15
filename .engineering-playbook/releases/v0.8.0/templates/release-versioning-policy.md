# {{PROJECT_NAME}} Release Versioning Policy

Use this record to make version numbers explain compatibility and maturity rather than edit frequency. Delete artifact rows that do not apply and add project-specific contracts when needed.

## Canonical release identity

- Repository/product identifier:
- Human-readable product name:
- Canonical `VERSION` file or manifest:
- Git tag format: `vMAJOR.MINOR.PATCH[-PRERELEASE]`
- Changelog path and format:
- Release owner and approval boundary:
- Current operating mode and channel:

Cross-repository references use `identifier@version`, for example `budgette@1.4.0` or `engineering-playbook@0.7.0`. Repositories use the same meaning for version changes but never synchronize numbers merely for appearance.

## Semantic release rules

| Change | Version effect | Project examples |
|---|---|---|
| Compatible corrections, clarifications, tests, or tooling with no intended new capability | Increment `PATCH`, for example `1.4.2` to `1.4.3` | |
| One coherent backward-compatible product, workflow, practice, or governance capability | Increment `MINOR` and reset `PATCH`, for example `1.4.2` to `1.5.0` | |
| Incompatible stable public/product, storage, protocol, instruction, governance, or support contract | Increment `MAJOR` and reset the rest, for example `1.4.2` to `2.0.0` | |
| Coherent pre-1.0 milestone or incompatible pre-1.0 contract change | Next `0.MINOR.0`, with compatibility called out | |
| Candidate distributed before the target release is complete | `-alpha.N`, `-beta.N`, or `-rc.N` | |

Do not bump a version for every commit, merged pull request, document edit, or time interval. Accumulate a coherent release batch under an `Unreleased` changelog section while its scope is still forming. As part of an approved release commit, move the entry to a dated version and tag that exact commit; do not describe it as published before remote tag verification.

### Prerelease channels

- `alpha.N`: incomplete or exploratory candidate; interfaces or behavior may change.
- `beta.N`: feature-complete enough for owner/tester use; defects and compatibility findings are expected.
- `rc.N`: intended final release content; only release-blocking corrections should change it.
- Stable: approved release with the repository's stated support and compatibility promise.

Increment `N` only when a new candidate is actually distributed or evaluated as a distinct candidate. Build automation may use separate monotonically increasing build numbers without creating another semantic release.

## Independent artifact identities

| Artifact family | Identifier and current version | Compatibility promise | Version owner/source | Release linkage |
|---|---|---|---|---|
| Repository/product release | | | | |
| Android/iOS/desktop/web build | | Store/channel rules; rebuild identity | | |
| Database schema/migration set | | Old/new reader-writer and rollback behavior | | |
| API/protocol/event contract | | Negotiation, deprecation, mixed-version behavior | | |
| File/export/import format | | Forward/backward read and round-trip behavior | | |
| Instruction/profile/skill manifest | | Loading and behavioral compatibility | | |
| Model/prompt/evaluation set | | Quality-contract and reproducibility boundary | | |
| Dataset/index/knowledge snapshot | | Provenance/freshness/rebuild boundary | | |
| Firmware/hardware revision | | Bootloader, protocol, mechanical/electrical compatibility | | |

Dated reports, evidence snapshots, experiments, and data cuts use ISO dates/timestamps. Git commit IDs identify exact source. Neither substitutes for a repository release version.

## Compatibility and support

- Minimum supported prior version and upgrade path:
- Mixed-version client/server, device/service, reader/writer, or profile/project behavior:
- Breaking-change detection and owner decision process:
- Deprecation window and evidence required before removal:
- Downgrade, rollback, roll-forward, and data-recovery policy:
- Long-lived release branches or supported-version policy, if any:

## `1.0.0` stability criteria

Version `1.0.0` is an explicit promise, not a topic-count or calendar milestone. Define what must be stable enough to support deliberately:

- Product/governance contract:
- Persistent data and migration contract:
- Public/internal interfaces and formats:
- Installation, release, rollback, and recovery:
- Supported platforms/users/environments:
- Security/privacy and owner-approval boundaries:
- Required quality evidence and known accepted limitations:

Record who declares the criteria satisfied and which decision/evidence supports that release.

## Release record minimum

Each release records:

- Repository identifier, semantic version, channel, date, commit, and annotated tag.
- Why the selected component changed and whether compatibility changed.
- User/owner-visible changes and known limitations.
- Linked build, schema, protocol, file, instruction, model/prompt, dataset, and firmware identities that changed.
- Validation, artifact checksum/signature where applicable, rollout, monitoring, rollback, and support window.
- Adoption or compatibility effects on other repositories without silently changing their versions or pins.
