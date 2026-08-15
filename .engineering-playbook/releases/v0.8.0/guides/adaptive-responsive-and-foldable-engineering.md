# Adaptive, Responsive, and Foldable Engineering

Status: Supplementary practice module. Select it for any user interface that can be resized, rotated, folded, run in multi-window mode, moved between displays, or used with more than one input method. For a native Android or foldable product, it is normally applicable rather than optional.

The goal is not to build a separate phone app, tablet app, and foldable app. The goal is one coherent product whose presentation adapts to the space and capabilities currently available while the user's task, data, and place remain continuous.

Use the [Adaptive Continuity Plan](../templates/adaptive-continuity-plan.md) for every critical creation, editing, checkout, authentication, media, messaging, or financial journey.

## The core contract

Treat these as different concerns:

1. **Product and domain state:** durable facts and business rules independent of any window.
2. **Workflow state:** the record being edited, current step, validation, selection, undo history, and in-flight operation identity.
3. **Restoration state:** the smallest keys and user inputs needed to reconstruct the workflow after recreation or process death.
4. **Presentation state:** current window dimensions, posture, panes, navigation chrome, focus, scroll, keyboard, and transient overlays.

Window size and fold posture are inputs to presentation. They must not choose a different business process, create a second draft, reset a state holder, repeat an external effect, or silently change the meaning of Back, Cancel, Save, or Submit.

For the same task and identity, compact and expanded presentations are views of the same workflow state. A layout transition may reveal, hide, move, reflow, or combine surfaces; it must not discard the user's work.

### The continuity invariant

Immediately before and after a supported configuration transition:

- The user is acting on the same logical object and task.
- Entered or selected values, validation status, and unsaved edits remain unless an explicitly documented privacy or product rule says otherwise.
- Navigation still represents the same place; a pane becoming visible is not a new task.
- Completed external effects are not repeated, and in-flight effects are resumed, reconciled, or shown honestly.
- Scroll, focus, selection, keyboard, dialog, media, and undo state are retained when they matter to continuing the task.
- No content is clipped, obscured by a hinge/cutout, made unreachable, or replaced by an unexplained blank or loading state.

Static folded and unfolded screenshots do not prove this invariant. Test the live transition while meaningful state is present.

## Architecture that makes adaptation cheap

### One workflow, multiple compositions

- Hoist workflow state above compact/medium/expanded presentation branches. Give it a stable task or record key rather than a window-class or posture key.
- Let adaptive containers compose the same state and actions differently. Avoid independently implemented `CompactEditFlow` and `ExpandedEditFlow` owners that can drift or reset.
- Keep validation, formatting, permissions, saving, reconciliation, and business rules out of layout branches.
- Use unidirectional state and idempotent commands so recreation or recomposition cannot repeat submissions, payments, imports, messages, or writes.
- Represent navigation semantically—selected record, destination, subtask—not as assumptions about how many panes happen to be visible.
- When a single-pane layout shows one destination and a multi-pane layout shows several, define deterministic selection and Back behavior for every transition direction.

Duplication can be valid for small presentational components optimized for different space. Duplicating workflow logic, mutable drafts, network effects, or route truth is the warning sign.

### Save the right state at the right durability

- Keep authoritative and completed data in the normal data layer.
- Keep screen-level workflow state in a lifecycle-aware state holder.
- Save only minimal restoration material—IDs, primitive input, selection, step, and semantic anchors—in platform restoration storage; reconstruct large objects from the data layer.
- Persist valuable or consequential drafts locally when process death, app update, crash, or long interruption should not destroy them. Define encryption, expiry, discard, migration, and conflict behavior.
- Treat focus, animation progress, and open menus as ephemeral unless losing them materially disrupts the task. Record deliberate exceptions instead of accepting accidental loss.

For Android Compose, choose state ownership from the behavior: `rememberSaveable` for small UI element state, a `ViewModel` for screen/business state across configuration changes, `SavedStateHandle` for minimal process-restoration inputs, and durable storage for valuable drafts or authoritative data. A `ViewModel` alone does not survive system-initiated process death. Avoid large objects in saved-instance bundles.

For Flutter, keep workflow state above layout branches, use stable keys, restoration APIs or durable storage according to consequence, and verify plugins/native extensions across metric changes. `PageStorageKey` can retain appropriate scroll state, but it is not a substitute for workflow restoration.

### Prefer recreation-safe design

Do not use manual configuration handling merely to hide lost-state defects. Default platform recreation is a useful design and test boundary. If the app handles configuration changes itself for a measured reason, document every configuration owned, update resources and metrics correctly, test combinations, and retain an equivalent process-death test.

## Size, layout, and posture decisions

### Adapt to the app window, not a device label

- Base layout on current app-window constraints, not model name, marketing category, physical screen size, natural orientation, or an `isTablet`/`isFoldable` flag.
- Assume a window can change continuously and repeatedly because of folding, rotation, split screen, freeform/desktop windowing, display movement, system UI, accessibility settings, or user resizing.
- Use named window-size classes or project breakpoints to choose major composition changes, then use fluid constraints within each class.
- Select breakpoints where the content or task needs them. Do not assume unfolding implies expanded width or that it always justifies two panes.
- Avoid fixed orientation, aspect-ratio, and resizability restrictions unless a documented essential experience cannot work otherwise and current platform behavior has been verified.
- Recompute size-, density-, inset-, and resource-dependent values. Do not cache startup metrics as permanent truth.

Responsive design makes components fit continuously. Adaptive design changes composition when more appropriate navigation, panes, density, or controls improve the task. Both are required.

### Use space intentionally

- Constrain readable text and form widths; a large display is not a reason to stretch every field edge to edge.
- Prefer canonical relationships such as list-detail and main-supporting content when the product model naturally has them.
- Let grids change column count, navigation move from bar to rail/panel, and secondary content become simultaneously visible when space supports it.
- Preserve content hierarchy and reading/focus order when elements move.
- Do not make an empty second pane mandatory. Use a useful default, clear selection state, or a single-pane composition.
- Keep critical actions reachable with touch, keyboard, mouse/trackpad, stylus, switch/D-pad, and assistive technology as applicable.

### Use fold information only when it matters

Window size solves most layouts. Consult a folding feature when the physical feature or posture changes usability:

- Avoid placing essential content, controls, dialogs, menus, camera subjects, or drag targets in an occluded or separating hinge region.
- Use tabletop or book posture for an intentional improvement—such as media above controls, preview above editing controls, or two-page reading—not merely because the sensor exists.
- Treat a non-occluding fold as a possible alignment guide, not an automatic divider.
- Do not rely on a precise hinge angle when the platform API or hardware cannot report it consistently.
- Test dual-display hinges, flexible folds, landscape-opening devices, and emerging tri-folds only when supported or material; never assume natural rotation zero means portrait.

## Design the transitions before coding

For each critical journey, define:

- Compact, medium, expanded, tall, wide, and relevant posture compositions.
- Which elements persist, move, reflow, become concurrent panes, or intentionally disappear.
- The stable task/record identity and state owner.
- What survives recreation, process death, backgrounding, and app update.
- Back, up, cancel, save, submit, pane-selection, deep-link, and restoration behavior.
- Focus, keyboard, scroll/semantic anchor, overlay, error, and in-flight-operation behavior.
- Hinge/cutout/inset avoidance and reachability.
- Performance expectations during a live resize or fold transition.

A design is incomplete when it provides only final screenshots for each size. Include at least one transition story with partially entered data and one with an operation in flight.

## Common expensive mistakes

| Mistake | Why it fails | Better pattern |
|---|---|---|
| Separate compact and expanded workflow implementations | State, validation, navigation, and fixes drift; transitions can reset work | One state owner and action contract with adaptive compositions |
| State keyed by width, orientation, or posture | A layout change destroys and recreates a different task identity | Key by stable record/task identity; derive presentation from current constraints |
| `ViewModel` or in-memory provider treated as durable restoration | Configuration may work while process death still loses a draft | Minimal saved restoration plus durable draft storage when consequence warrants |
| Device-type checks | Multi-window and freeform windows break the phone/tablet assumption | Current window metrics and content-driven breakpoints |
| Unfolded always means two pane | Some unfolded windows remain medium or narrow; empty panes waste space | Choose composition from usable width and task relationship |
| Orientation or aspect-ratio lock | Causes letterboxing, compatibility behavior, and accessibility problems | Resizable layouts; narrowly justify and test any essential exception |
| Handling `configChanges` to avoid recreation | Masks missing state ownership and creates manual update obligations | Recreation-safe state first; manual handling only for a measured need |
| Startup dimensions cached forever | Fold, density, window, inset, or display changes make them stale | Observe current metrics and recompute derived values |
| Hinge treated as a universal gutter | Flexible folds may not occlude or separate; controls can be misplaced | Respond to actual occlusion/separation and supported posture |
| Screenshots used as continuity proof | They cannot prove retained data, focus, Back behavior, or no repeated effects | Stateful transition automation plus physical-device evidence |
| Emulator-only acceptance | Misses OEM continuity, background policy, thermals, touch reach, and animation behavior | Fast emulator matrix plus a small representative physical-device set |

## Verification ladder

### Fast checks on each relevant change

- Unit-test breakpoint and pane-selection policy as pure logic where possible.
- Render component/previews at boundary widths just below, at, and above each breakpoint; include tall, short, wide, font-scaled, RTL, dark/light, and long-content cases.
- Run state-restoration tests with a partly completed critical flow.
- Verify that compact and expanded compositions consume the same state/actions and do not create effects during rendering.
- Use visual regression to detect clipping, overlap, excessive stretch, missing actions, and unintended hierarchy changes.

### Instrumented transition checks

Automate at least one critical stateful journey through:

1. Compact → expanded → compact.
2. Portrait → landscape → portrait.
3. Full window → multi-window resize → full window.
4. Flat → relevant half-open posture → flat, when posture behavior exists.
5. Activity recreation and system-initiated process-restoration simulation.
6. A combined sequence such as resize → rotate → fold/unfold.

Before transitioning, enter distinctive synthetic values, place the cursor or selection, scroll to a named item, open the relevant pane or dialog, and start a safely controlled in-flight operation. After each transition, assert task identity, values, validation, navigation, visible actions, semantic focus/anchor, and effect count—not only that the app did not crash.

On modern Android toolchains, evaluate Compose `StateRestorationTester`, `DeviceConfigurationOverride`, Compose preview screenshot testing, `ActivityScenario`, and the Espresso Device API for synchronized fold/unfold and rotation actions. Use the resizable and foldable emulators in CI where stable. Reverify current versions before adding dependencies.

### Physical-device acceptance

- Keep a small device matrix chosen by behavior, not brand count: a compact phone, the owner's target foldable, and a larger/freeform environment when supported.
- Exercise outer/inner display changes, real hinge/posture, density and natural-orientation differences, multi-window, external keyboard, backgrounding, and OEM task behavior.
- Capture app/build identity, device model, OS/build, effective window dp, density, posture, font scale, input mode, steps, screen recording or screenshots, logs, and result.
- Profile transition jank, unnecessary recomposition/rebuild, memory spikes, duplicate requests, and relaunch loops in a release-like build.
- Restore every changed device setting after testing.

Remote device streaming and farms broaden compatibility, but verify whether they expose the physical transition and OEM behavior required by the test. A resized screenshot from a farm is not proof of fold continuity.

## Project quality levels

For Android, record the intended current [Adaptive app quality](https://developer.android.com/develop/adaptive-apps/quality-guidelines/adaptive-app-quality) tier and test evidence:

- **Adaptive ready:** every critical task works without letterboxing or lost state across configurations, with basic external-input support.
- **Adaptive optimized:** layouts and inputs are intentionally optimized across supported sizes and states.
- **Adaptive differentiated:** the product uses relevant posture, multitasking, drag/drop, stylus, or other form-factor strengths to improve the experience.

Treat “ready” as the compatibility floor, “optimized” as the normal target for a high-quality maintained Android app, and “differentiated” as product-specific opportunity—not ceremony every app must perform.

## Framework routing

### Native Android and Compose

- Prefer current window adaptive information and Material 3 Adaptive primitives where they fit; canonical list-detail and supporting-pane scaffolds can reduce custom navigation/layout drift.
- Use Jetpack WindowManager folding data for occlusion, separation, orientation, and supported posture behavior.
- Test configuration recreation by default. Treat manual `configChanges` ownership as an explicit architecture decision.
- Audit libraries, activities, camera/media surfaces, maps, WebViews, and native/FFI boundaries for stale metrics or state loss.

Official starting points: [Get started with adaptive apps](https://developer.android.com/develop/adaptive-apps/guides/get-started-with-adaptive-apps), [configuration and continuity](https://developer.android.com/guide/topics/large-screens/configuration-and-continuity), [test different screen and window sizes](https://developer.android.com/training/testing/different-screens), [Espresso Device API](https://developer.android.com/studio/test/espresso-api), [save UI state in Compose](https://developer.android.com/develop/ui/compose/state-saving), and [fold awareness](https://developer.android.com/develop/adaptive-apps/guides/foldables/make-your-app-fold-aware).

### Flutter

- Drive layout from the current view/window constraints with `LayoutBuilder`, `MediaQuery.sizeOf`, and stable project breakpoints as appropriate; avoid device-type and top-level orientation branching.
- Keep state above adaptive widget branches; use stable keys, restoration, and durable storage according to the continuity contract.
- Audit platform plugins and native services across metric, activity, and display changes.
- Use Flutter widget/golden/integration tests for layout and state plus Android device-level tests for the physical fold/activity boundary.

Official starting points: [Adaptive and responsive design](https://docs.flutter.dev/ui/adaptive-responsive), [adaptive best practices](https://docs.flutter.dev/ui/adaptive-responsive/best-practices), and [large screen devices](https://docs.flutter.dev/ui/adaptive-responsive/large-screens).

### Other UI stacks

Apply the same separation: current window constraints select presentation; stable product/workflow state survives it. Use the platform's lifecycle and restoration facilities, responsive layout system, hinge/display-feature API, accessibility tree, and end-to-end automation. Prove the hardest transition in a small spike before committing to a cross-platform framework or navigation architecture.

Samsung's [app continuity guidance](https://developer.samsung.com/galaxy-z/app-continuity.html) and Microsoft's archived [foldable/dual-screen patterns](https://learn.microsoft.com/en-us/previous-versions/dual-screen/) are useful OEM/form-factor supplements. Treat archived material as pattern history, and reconcile all vendor advice with current Android platform guidance and physical target-device evidence.

## Completion evidence

An adaptive/foldable change is complete only when the project records:

- Supported window/posture/input matrix and intended quality tier.
- Stable state ownership and restoration policy for affected journeys.
- Automated boundary rendering and stateful transition results.
- At least one combined transition and process-restoration result for critical flows.
- Physical target-device evidence at the project's release/milestone cadence.
- Known unsupported states, deliberate losses, OEM/framework limitations, and owner-visible consequences.
- Performance, accessibility, privacy, and recovery findings caused by the adaptive behavior.

Passing this guide does not mean every screen must use every pane or fold posture. It means supported changes in the user's environment do not destroy the user's task, and extra space or hardware capabilities are used deliberately when they improve the product.
