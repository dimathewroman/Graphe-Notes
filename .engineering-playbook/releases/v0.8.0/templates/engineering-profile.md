# Project Engineering Profile

## Identity

- Project: {{PROJECT_NAME}}
- Owner:
- Repository:
- Authoritative roadmap:
- Current release/channel:
- Canonical repository/product release identity and version policy:
- Current prerelease/stability status and written `1.0.0` criteria:
- Independent build, schema, API/protocol, file/export, instruction, model/prompt, dataset, or firmware identities that apply:
- Current lifecycle stage:
- Next evidence gate:
- Product outcome and guardrail measures:

## Operating mode

- Mode: Discovery/Lab / Private daily driver / External beta / Public/production
- Users and devices:
- Distribution path:
- Offline or degraded-operation expectations:

## Platform horizon and portability

- First platform and reason:
- Likely next platforms and evidence/decision trigger for each:
- UI strategy per target: native / React Native / Flutter / web/PWA / Capacitor-style shell / desktop shell / other
- Portable domain/data/contracts and platform-owned layers:
- Hardest native capability spike required before framework commitment:
- Feature-parity ledger and accepted platform-specific differences:
- Local database, cloud/API boundary, sync/conflict, migration, import/export, and file/media registry:
- On-device collection sizes, ingest/search/RAG needs, index strategy, capacity envelope, and rebuild/delete behavior:
- API, IPC, event, interdevice, provider, and MCP boundaries with their contract records:
- Build/signing/distribution and representative physical-device requirements per target:

## Product profiles

Select the applicable profiles and explain why:

- Web/SaaS
- Native Android/foldable
- Cross-platform/mobile port or web-native wrapper
- Messaging/communications
- Financial/Plaid
- Local-first/offline
- AI-enabled
- Private OTA
- Other:

## Selected specialist guides

Use the canonical [`guides/README.md`](../guides/README.md) trigger table. Select only what is relevant; mark a normally relevant guide Not Applicable with a short rationale.

| Guide | Trigger | Selected / Not Applicable | Rationale, required evidence, and review trigger |
|---|---|---|---|
| | | | |

## System and physical scope

- Hardware involvement: HS0 software only / HS1 integrates hardware / HS2 embedded prototype / HS3 custom hardware / HS4 marketed or safety-relevant physical product
- Independent risk tier: R0 / R1 / R2 / R3, with rationale:
- Critical software/OS/firmware/protocol/electrical/mechanical boundaries:
- Power, timing, memory, bandwidth, thermal, cost, safety, and manufacturing budgets that apply:
- Cross-layer critical paths and low/middle/high device-tier adaptations:

## Sensitive assets and trust boundaries

- Data classes:
- Credentials and identity:
- External services:
- AI/API provider account, subscription-versus-API billing, credential custody, retention/training, and exit assumptions:
- Device and network boundaries:
- Retention and deletion expectations:

## Quality targets

- Reliability/service indicators:
- Performance budgets:
- Frame/input, startup, memory/working-set, storage/index, network, battery, thermal, and sustained-load budgets:
- Accessibility/localization:
- Compatibility matrix, including window classes, postures, orientations, display modes, and input methods:
- Intended Android adaptive quality tier, if applicable: Adaptive ready / optimized / differentiated
- Critical journeys requiring an Adaptive Continuity Plan:
- Required test layers:
- CI semantic change classes, always-running classifier, feedback budgets, and full integration/release fallback:
- Current GitHub capability/security inventory and next review trigger:
- Production-health signals:
- Support route and diagnostic evidence:
- Recovery objectives and drill cadence:
- Supported-version, export, dependency-exit, and retirement path:
- Mixed-version compatibility, migration, and downgrade policy:

## Governance

<!-- engineering-playbook-managed:start -->
- Adopted playbook version and checksum: `{{PLAYBOOK_VERSION}}`, `{{PLAYBOOK_SHA256}}`
- Exact pinned playbook path: `.engineering-playbook/releases/v{{PLAYBOOK_VERSION}}/PLAYBOOK.md`
<!-- engineering-playbook-managed:end -->
- Latest stable playbook consulted:
- Latest-consultation date or task record:
- Newer guidance used for the current task:
- Newer guidance deferred or found incompatible, with rationale:
- Standing owner authorizations:
- Exceptions and expiration dates:
- Required independent review:
