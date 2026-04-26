# Performance

Reference for the performance testing system in Graphe Notes. Read this before submitting any PR that touches rendering, data fetching, animation, or editor behavior.

---

## What is tracked

Eight interaction timings are measured by the Playwright performance suite (`artifacts/next-app/e2e/08-performance.spec.ts`). All run in demo mode at 1280×800 using wall-clock time (`Date.now()`).

| Key | What it measures |
|---|---|
| `app_initial_load` | `page.goto("/")` → login screen (demo) or app shell (auth) visible |
| `mode_entry` | "Enter demo mode" click → demo banner visible |
| `note_creation` | New-note button click → note item appears in list |
| `note_switch` | Click second note → title input + ProseMirror visible |
| `bold_toggle` | Bold button click → `data-state="on"` confirmed |
| `sidebar_nav_switch` | Nav click → first Quick Bit item visible |
| `settings_open` | Settings button click → settings modal visible |
| `version_history_open` | Version history button click → panel visible |

---

## Baselines

Two baseline files are committed to the repo. CI enforces against `perf-baseline-ci.json`. Local runs compare against `perf-baseline.json`.

### Local baseline — `artifacts/next-app/e2e/perf-baseline.json`

Dev server (`next dev`), macOS. Recorded 2026-04-26.

| Metric | Baseline |
|---|---|
| App initial load | 266ms |
| Demo mode entry | 182ms |
| Note creation | 191ms |
| Note switch | 72ms |
| Bold toggle | 85ms |
| Sidebar nav switch | 41ms |
| Settings open | 49ms |
| Version history open | 86ms |

### CI baseline — `artifacts/next-app/e2e/perf-baseline-ci.json`

Production build (`next build` + `next start`), Ubuntu, GitHub-hosted runner. Recorded 2026-04-26.

| Metric | Baseline |
|---|---|
| App initial load | 382ms |
| Demo mode entry | 237ms |
| Note creation | 193ms |
| Note switch | 133ms |
| Bold toggle | 59ms |
| Sidebar nav switch | 55ms |
| Settings open | 104ms |
| Version history open | 81ms |

CI baselines are higher than local for most metrics because GitHub-hosted runners are slower than a developer laptop. Bold toggle is the exception — the production build executes faster than the dev server for synchronous DOM operations.

---

## Thresholds

| Severity | Multiplier | Effect |
|---|---|---|
| Warn | ≥ 1.5× baseline | Logged to console + attached as a Playwright test annotation; does **not** fail the test |
| Fail | ≥ 2.5× baseline | `expect()` assertion failure — the CI job fails |

These constants live in `08-performance.spec.ts` as `WARN_MULT` and `FAIL_MULT`.

---

## How to run locally

### Playwright performance suite

Requires the dev server running on port 3000:

```bash
# Start dev server in another terminal
pnpm --filter @workspace/next-app run dev

# Run the perf spec against the local baseline
pnpm --filter @workspace/next-app exec playwright test 08-performance.spec.ts --project=chromium
```

On first run, if `perf-baseline.json` is empty or missing, the suite records the measured values as the new baseline and exits without thresholding. On subsequent runs it compares against the recorded baseline.

To use the CI baseline file locally (e.g. to simulate what CI would enforce):

```bash
PERF_BASELINE_FILE=$(pwd)/artifacts/next-app/e2e/perf-baseline-ci.json \
  pnpm --filter @workspace/next-app exec playwright test 08-performance.spec.ts --project=chromium
```

### API benchmark script

Measures response times for key API endpoints against the local dev server. Requires real credentials (not demo mode).

Prerequisites:
- Dev server running on port 3000
- `.env` at repo root with `TEST_EMAIL`, `TEST_PASSWORD`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`

```bash
pnpm --filter @workspace/scripts run benchmark
```

Reports avg / min / max / p95 over 5 runs for: `GET /api/notes`, `GET /api/folders`, `GET /api/quick-bits`, `GET /api/tags`, `GET /api/notes/:id` (3 sampled notes), `GET /api/notes/:id/versions`, `PATCH /api/notes/:id` (save).

---

## How to read the CI output

### PR comment

Every CI run posts (or updates) a comment on the PR with a table like:

```
## ⚡ Performance Report

> Compared against CI baseline recorded at `2026-04-26T22:58:55.897Z`.
> Thresholds: ⚠️ warn ≥1.5×  ❌ fail ≥2.5×

| Metric                  | Baseline | Current | Ratio  | Status       |
|-------------------------|----------|---------|--------|--------------|
| App initial load        | 382ms    | 401ms   | 1.05×  | ✅ PASS      |
| Note switch             | 133ms    | 210ms   | 1.58×  | ⚠️ WARN      |
| ...                     | ...      | ...     | ...    | ...          |
```

The comment is identified by the HTML marker `<!-- graphe-perf-report -->` and updated in place on re-runs so it doesn't pile up.

### Artifacts

Two artifacts are uploaded per run:
- **`perf-report`** — `perf-results/perf-report.json` — machine-readable, retained 30 days
- **`perf-baseline-ci`** — `e2e/perf-baseline-ci.json` — the baseline used for comparison, retained 30 days

Download `perf-report.json` from the Actions run to inspect exact ratios for all metrics.

### Recording mode

If `perf-baseline-ci.json` is empty when CI runs, the comment says **"Recording mode"** and instructs you to download the artifact and commit the file. No threshold enforcement happens on a recording run.

---

## How to update baselines

Update the baseline when a change intentionally makes a metric slower (e.g., adding a feature that requires extra work on note creation) and the new timing is the correct new normal.

**Local baseline:**

```bash
# Delete the existing baseline, then re-run the suite once to record fresh values
rm artifacts/next-app/e2e/perf-baseline.json
pnpm --filter @workspace/next-app exec playwright test 08-performance.spec.ts --project=chromium
# Commit the updated perf-baseline.json
```

**CI baseline:**

```bash
rm artifacts/next-app/e2e/perf-baseline-ci.json
git push  # CI will record a new baseline on its next run
# Download perf-baseline-ci.json from the Actions artifacts
# Move it to artifacts/next-app/e2e/perf-baseline-ci.json and commit it
```

Always describe *why* the baseline changed in the PR description — a regression and an intentional slowdown look identical in the diff.

---

## Patterns to follow

**React.memo on list item components.** Note list, Quick Bits list, folder list, and template list items re-render on every parent state change without memoization. Wrap item components in `React.memo` and ensure props are stable references.

**Optimistic cache updates instead of broad `invalidateQueries`.**

```typescript
// Bad — refetches the entire notes list on every pin toggle
queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });

// Good — patch only the changed record in place
queryClient.setQueryData(getGetNoteQueryKey(id), (old) => ({ ...old, pinned: true }));
```

**CSS-first motion.** Use CSS transitions for simple enter/exit and hover states. Reserve Framer Motion for springs, gesture-driven animations, and `layout` animations where CSS cannot express the behavior.

**Framer Motion: no `layout` prop on list items.** The `layout` prop triggers layout measurement on every render. On a list of 50+ notes it causes visible jank. Use CSS transitions for list reordering instead.

**Animate only GPU-composited properties.** `transform` and `opacity` are composited and do not trigger layout or paint. Everything else does.

**Use `useAnimationConfig()`** from `hooks/use-motion.ts` for all Framer Motion transition values. It returns timing objects tuned to the user's motion level setting — hardcoding durations bypasses this.

---

## Anti-patterns to avoid

**Broad query invalidation on simple mutations.** Invalidating the notes list after a pin, favorite, or tag update causes a full network round-trip and a list re-render. Use `setQueryData` to update the specific record.

**Re-initializing the Tiptap editor on content switch.** The editor instance is expensive to create. Switching notes must update `editor.commands.setContent()` — never unmount and remount `<GrapheEditor />` on note change.

**Fetching full note content when only metadata is needed.** The notes list endpoint (`GET /api/notes`) returns `id`, `title`, `contentText` (plain text preview), and metadata — not the full HTML content. Do not call `GET /api/notes/:id` in the list to get metadata that the list endpoint already provides.

**Animating layout properties.** `width`, `height`, `top`, `left`, `margin`, and `padding` trigger layout recalculation on every frame. Use `transform: scaleX()` / `translateX()` instead of animating `width`. Use `transform: translateY()` instead of animating `top`/`margin-top`.

**Hover-only interactions on touch devices.** Hover effects that expand touch targets or reveal actions are invisible on touch. This is also a correctness issue — see the touch requirements in CLAUDE.md.
