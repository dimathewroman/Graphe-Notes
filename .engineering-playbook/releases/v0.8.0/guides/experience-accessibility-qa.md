# Experience and Accessibility QA

Status: Supplementary practice module. A project selects the applicable platform standards, conformance target, devices, and assistive technologies in its engineering profile.

Experience QA asks whether the product is understandable, operable, accessible, responsive, and recoverable in realistic conditions. Automated checks help find defects; they do not certify usability or accessibility. The owner remains the final product decision-maker and should receive user-visible trade-offs in plain language.

## Define the experience contract

For each critical journey, name:

- The user, goal, entry point, prerequisites, and completion signal.
- The authoritative product/design reference and any deliberate platform divergence.
- Supported input methods, window classes, orientations, themes, locales, text scales, and assistive technologies.
- The states and interruptions that must be handled.
- Accessibility target and required manual evidence.
- Subjective qualities the owner will evaluate, such as clarity, calmness, density, motion, or delight.

Use the [UI State and Journey Matrix](../templates/ui-state-and-journey-matrix.md). One matrix should drive design review, implementation acceptance, accessibility QA, visual evidence, and regression tests instead of spawning separate contradictory checklists. When a critical journey can resize, rotate, fold, change display mode, recreate, or restore, pair it with the [Adaptive Continuity Plan](../templates/adaptive-continuity-plan.md); final-state screenshots alone cannot prove continuity.

## Test the complete state space

At minimum consider:

- First use, returning use, signed out, signed in, and expired access.
- Loading, empty, partial, stale, unavailable, offline, retrying, and recovered.
- Valid, invalid, duplicate, conflicting, long, translated, right-to-left, and user-generated content.
- Permission not requested, granted, denied, revoked, and permanently unavailable.
- Destructive confirmation, cancellation, undo, interrupted operation, and partial success.
- Backgrounding, process death, resize, fold/unfold, rotation, keyboard appearance, multi-window, and external handoff where applicable.
- Low memory/storage, slow input/device, high latency, dependency failure, and disabled feature.

Verify that the product communicates uncertainty and recovery honestly. A polished success path does not compensate for a silent failure state.

## Design-to-build review

- Compare behavior, hierarchy, spacing, typography, color, content, focus, and motion to the authoritative reference.
- Use realistic content and boundary-length values, not only ideal fixtures.
- Confirm that reusable components and design tokens express shared decisions; avoid local near-duplicates.
- Review native platform conventions and accessibility behavior before inventing a custom control.
- Record intentional differences. Do not normalize an implementation accident by updating the design baseline without review.
- Inspect on representative hardware; simulator/browser screenshots do not prove touch feel, keyboard behavior, animation pacing, haptics, thermals, or assistive-technology output.

## Accessibility workflow

### Establish the target

Record the applicable standard and platform guidance. For a web product this may be WCAG 2.2 at a chosen conformance level; native apps should also use current platform guidance. A standard is a source of criteria, not an automatic certification claim.

When advertising formal conformance or entering public-sector, enterprise, procurement, educational, or contractual commitments that require it, obtain appropriately qualified review and the required Accessibility Conformance Report or equivalent evidence rather than inferring compliance from internal checks.

### Build accessibility into the design

- Provide programmatic name, role, value, state, and relationships.
- Keep reading, focus, and navigation order logical.
- Make every action operable with supported non-touch input and assistive technology.
- Preserve meaning without relying only on color, shape, position, sound, motion, or haptics.
- Support text resize/reflow, zoom, contrast, reduced motion, captions/transcripts, and sufficient targets as applicable.
- Announce dynamic status, validation, errors, and completion without unnecessary interruption.
- Make time limits, authentication, destructive actions, and error recovery understandable and forgiving.
- Avoid focus traps and unexpected context changes.

### Test with complementary methods

1. Automated analysis for detectable semantics, contrast, labels, targets, and focus issues.
2. Keyboard, switch, directional, and alternate-input navigation where supported.
3. Screen-reader review of critical journeys on representative platforms.
4. Text scaling, zoom/reflow, contrast, color-vision, reduced-motion, and orientation checks.
5. User testing with people who use relevant assistive technologies when product risk and reach justify it.

Automation cannot determine whether labels are useful, reading order is sensible, a workflow is cognitively clear, or the experience works with real assistive technology.

## Visual regression

- Baselines are reviewed artifacts tied to a design/product decision, platform, viewport, content fixture, theme, locale, and text scale.
- Mask nondeterministic regions narrowly; do not hide meaningful variation.
- Separate rendering noise from product change and investigate unexplained differences.
- Require human review for accepted visible changes.
- Cover state and behavior, not a gallery of redundant screens.
- Test motion with recordings or frame/trace evidence when timing matters.

## Interaction and content QA

Verify:

- Hit targets, hover/focus/pressed/disabled states, gesture alternatives, scroll behavior, and back/cancel behavior.
- Form labels, instructions, validation timing, autofill, copy/paste, input modes, and error preservation.
- Plain language, consistent terminology, actionable errors, and no blame-oriented copy.
- Dates, numbers, units, currencies, names, addresses, pluralization, truncation, and bidirectional text.
- Notifications, deep links, share flows, external browsers/apps, and return paths.
- Privacy-sensitive surfaces such as lock screens, Recents/app switcher, screenshots, and assistive-technology announcements.

## Usability evidence

For an important new flow, give a participant a realistic goal without teaching the interface. Record completion, errors, hesitation, workarounds, confidence, and comments separately from the facilitator's interpretation.

Prioritize findings by user harm, frequency, reach, recoverability, and evidence strength. A single observation can reveal a real defect but does not establish population frequency.

## Exit evidence

Experience QA is complete when:

- The critical journey/state matrix has evidence or an explicit, accepted gap.
- Applicable automated and manual accessibility checks pass.
- Visible changes have reviewed before/after evidence.
- Supported platform/device/input combinations have proportional coverage.
- Known limitations identify who is affected, workaround, owner, and review trigger.
- The owner has reviewed subjective experience where owner acceptance is required.

## Useful references

- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) is the normative web accessibility recommendation.
- [W3C Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/) provides non-normative explanation and techniques.
- [Android accessibility testing](https://developer.android.com/guide/topics/ui/accessibility/testing) recommends combining manual, analysis-tool, automated, and user testing.
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) provide current Apple-platform design and accessibility guidance.

Tools such as accessibility scanners, browser audits, screenshot frameworks, and screen readers are examples. Select them for the supported stack and verify their current limitations.
