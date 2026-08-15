# Adaptive Continuity Plan: JOURNEY

Use this for a critical journey that can cross window sizes, orientations, display modes, fold postures, lifecycle recreation, or process death. Link it from the broader [UI State and Journey Matrix](ui-state-and-journey-matrix.md) and [Quality and Verification Plan](quality-and-verification-plan.md).

## Journey and support contract

- User goal and completion signal:
- Stable task/record identity:
- Authoritative product/design reference:
- Platforms and minimum versions:
- Intended Android adaptive quality tier, if applicable:
- Supported window classes/ranges, postures, orientations, display modes, and inputs:
- Deliberately unsupported cases and owner-visible effect:
- Representative emulator/virtual devices:
- Representative physical devices:

## State ownership

| State | Example/value | Authoritative owner | Stable key | Survives resize/fold | Survives recreation | Survives process death/update | Expiry/discard/conflict behavior |
|---|---|---|---|---|---|---|---|
| Domain/data | | | | | | | |
| Workflow/draft | | | | | | | |
| Navigation/selection | | | | | | | |
| Validation/error | | | | | | | |
| In-flight effect | | | | | | | |
| Scroll/semantic anchor | | | | | | | |
| Focus/keyboard/selection | | | | | | | |
| Overlay/dialog/transient UI | | | | | | | |

State-loss policy and rationale, including privacy-sensitive drafts:

## Adaptive composition

| Window/feature condition | Navigation | Primary content | Supporting/detail content | Content-width/density rule | Fold/inset avoidance | Back/focus behavior |
|---|---|---|---|---|---|---|
| Compact | | | | | | |
| Medium | | | | | | |
| Expanded | | | | | | |
| Tall/wide exception | | | | | | |
| Tabletop/book/separating hinge | | | | | | |
| Multi-window/freeform | | | | | | |

Breakpoint rationale from content/task needs:

## Continuity assertions

Populate only relevant rows, but never omit typed/selected data, task identity, navigation, or effect count for an editing/submission journey.

| Before transition | Transition sequence | Required state after transition | Layout/accessibility assertion | Effect-count/reconciliation assertion | Automated evidence | Physical evidence | Result |
|---|---|---|---|---|---|---|---|
| Partly entered compact flow | Compact → expanded → compact | | | | | | |
| Selected detail in expanded layout | Expanded → compact → expanded | | | | | | |
| Keyboard open and field focused | Rotate or unfold | | | | | | |
| Scrolled to named semantic item | Resize and rotate | | | | | | |
| Dialog/menu/picker open | Fold/unfold | | | | | | |
| Safe in-flight operation | Resize → rotate → fold/unfold | | | | | | |
| Partly entered flow | Activity recreation | | | | | | |
| Valuable unsaved draft | Process death/restoration | | | | | | |
| Running current version | App update/restore | | | | | | |

## Rendering boundary matrix

Include values immediately below, at, and above every project breakpoint.

| Window width × height dp | Font scale | Locale/direction | Theme/contrast | Input | Expected composition | Visual/semantic evidence | Result |
|---|---:|---|---|---|---|---|---|
| | | | | | | | |

## Failure and performance checks

- [ ] No crash, relaunch loop, blank surface, compatibility mode, or letterboxing in supported states.
- [ ] No duplicate submit/write/network effect from recreation or recomposition.
- [ ] No stale startup dimensions, density, resources, safe insets, or fold bounds.
- [ ] No unreachable/clipped control, hinge-obscured content, excessive field/text width, or broken focus order.
- [ ] Back, up, cancel, pane selection, deep links, undo, and restoration remain coherent.
- [ ] External keyboard, pointer/trackpad, stylus, D-pad/switch, and assistive technology work where supported.
- [ ] Transition frame time, rebuild/recomposition, memory, and network behavior are within recorded budgets.
- [ ] Relevant framework plugins, WebViews/maps/camera/media, and native/FFI boundaries retain state.
- [ ] Synthetic/private data handling and captured evidence follow the project's privacy rules.
- [ ] Device settings changed for testing were restored.

## Evidence environment

- App version/commit/build type:
- Toolchain and dependency versions:
- Device model, OS/build, effective window dp, density, natural orientation, posture, font scale, and input mode:
- Automation/emulator/device-farm configuration:
- Logs, recordings, screenshots, traces, reports, and artifact checksums:
- Harness limitations and negative control:

## Decision

- Verified facts:
- Regressions or unresolved cases:
- Framework/OEM/harness limitations:
- Recommendation: proceed / proceed with recorded limitation / stop / owner decision needed
- Owner-visible consequence and workaround:
- Follow-up owner and trigger/date:
