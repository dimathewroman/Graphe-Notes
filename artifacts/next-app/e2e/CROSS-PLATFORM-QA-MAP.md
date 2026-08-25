# Cross-platform QA map

The opt-in smoke matrix in `cross-platform-e2e/14-cross-platform-smoke.spec.ts` checks only the
public boot, demo-mode, note-list, and title-editor seams across desktop
Chromium/WebKit/Firefox plus mobile Chrome/Safari emulation. It is a fast
browser-compatibility signal, not release or physical-device acceptance.

| Later risk | Required test evidence | Current status |
| --- | --- | --- |
| AI permissions, streaming, provider errors, and cancellation | Deterministic demo-AI contract tests, then authenticated provider contract and failure-path E2E with synthetic responses | Existing demo-AI harness is separate; not part of this matrix |
| Yjs offline edits, reconnect, ordering, and conflict recovery | Two-context/browser tests with controlled network transitions and invariant-based document convergence assertions | Not covered |
| Excalidraw pointer/touch editing, resize, persistence, and export | Focused desktop/mobile pointer tests plus visual/export artifact checks at supported widths | Not covered |
| Capacitor WebView, keyboard, safe areas, file/photo picker, lifecycle, and native permissions | Physical iOS/Android UAT on named devices with native logs and repeatable offline/foreground-background scenarios | Playwright emulation is not a substitute; not covered |

Run the browser matrix explicitly with:

```bash
pnpm --filter @workspace/next-app run test:e2e:cross-platform
```

This runs two smoke tests in each of five projects, needs no credentials, and
starts an isolated local server on port 3101. Install the matching Playwright
browsers before running on a new machine. The default `test:e2e`, authenticated,
and CI Chromium commands remain unchanged.
