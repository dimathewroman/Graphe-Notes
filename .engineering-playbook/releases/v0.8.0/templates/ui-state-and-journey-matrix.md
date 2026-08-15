# UI State and Journey Matrix: TITLE

Use this as the shared design, implementation, accessibility, and QA contract for one important journey.

## Journey contract

- User and goal:
- Entry point and prerequisites:
- Completion and confirmation:
- Authoritative product/design reference:
- Supported platforms, window classes, and input methods:
- Accessibility target and assistive technologies:
- Known exclusions or owner decisions:

## Journey steps

| Step | User intent/input | Visible system response | Data/system effect | Back/cancel/recovery | Accessibility behavior | Evidence |
|---|---|---|---|---|---|---|
| | | | | | | |

## State coverage

| State or condition | Expected content/actions | Announcement/focus/input | Persistence/restart behavior | Platforms/configurations | Test/evidence | Status |
|---|---|---|---|---|---|---|
| Loading | | | | | | |
| Empty/first use | | | | | | |
| Partial/stale | | | | | | |
| Offline/unavailable | | | | | | |
| Invalid/conflict | | | | | | |
| Permission denied/revoked | | | | | | |
| Interrupted/restarted | | | | | | |
| Success | | | | | | |
| Failure/retry | | | | | | |
| Destructive/undo | | | | | | |

Add only relevant project-specific states, such as fold/unfold, expired identity, delayed sync, partial attachment, or cross-device conflict. For a critical adaptive journey, link an [Adaptive Continuity Plan](adaptive-continuity-plan.md) and test live transitions with partly entered state rather than only rendering each endpoint.

## Presentation matrix

| Dimension | Required cases | Evidence/result |
|---|---|---|
| Window/device/posture | | |
| Theme/contrast | | |
| Text scale/zoom/reflow | | |
| Locale/RTL/long content | | |
| Keyboard/pointer/touch/switch | | |
| Screen reader/focus order | | |
| Reduced motion/audio/haptics | | |

## Findings and decision

- Verified facts:
- Usability/accessibility findings:
- Design-to-build differences and rationale:
- Limitations, affected users, and workaround:
- Recommendation and owner decision needed, if any:
- Follow-up owner and trigger/date:
