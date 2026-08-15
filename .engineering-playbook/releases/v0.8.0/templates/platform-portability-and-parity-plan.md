# Platform Portability and Parity Plan: TITLE

## Product horizon

- First platform and reason:
- Likely next platforms and decision triggers:
- Supported form factors and OS versions:
- Distribution channels:
- Hardest native/platform capabilities:
- Acceptable web/PWA/desktop substitute:
- Owner-visible non-goals:

## Architecture map

| Layer/capability | Authoritative contract | Android implementation | Apple implementation | Web/desktop implementation | Shared code or fixtures | Native escape hatch |
|---|---|---|---|---|---|---|
| Domain rules | | | | | | |
| Workflow/state | | | | | | |
| Local data | | | | | | |
| Sync/API | | | | | | |
| UI/navigation | | | | | | |
| Files/media/share | | | | | | |
| Security/identity | | | | | | |
| Background/notifications | | | | | | |

## Framework decision

- Candidates and hardest-capability spike:
- Chosen approach and why:
- Code expected to be shared:
- Code intentionally native/platform-specific:
- Plugin/bridge/FFI ownership:
- Upgrade/abandoned-dependency and exit plan:
- Build/signing hardware and services:

## Parity ledger

| Capability/journey | Contract parity | Android | iOS/iPadOS | macOS | Web/Windows | Intentional platform difference or gap | Evidence/owner |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Data and migration

- Stable identity and account model:
- Local/cloud truth and sync conflict model:
- Versioned API/schema/file formats:
- Android-to-Apple transfer/import path:
- Non-portable credentials, purchases, keys, tokens, or files:
- Coexistence, rollback, export, and recovery:

## Verification and release

- Shared fixtures and acceptance scenarios:
- Per-platform unit/integration/UI/device layers:
- Adaptive/accessibility/input matrix:
- Performance and resource budgets:
- Cross-platform differential tests:
- Store/beta channels and signing:
- Feature-gap disclosure and support:

## Decisions and triggers

- Next platform spike date/condition:
- Refactor required before porting:
- Deferred sharing or portability work:
- Owner decisions and accepted trade-offs:
