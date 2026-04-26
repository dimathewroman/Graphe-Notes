/**
 * Performance baseline suite.
 *
 * Measures real interaction timings using the browser Performance API + wall-clock
 * timestamps.  On first run (no baseline recorded) results are saved as the baseline.
 * Subsequent runs compare against the baseline:
 *   - ≥ 1.5× baseline → warning annotation
 *   - ≥ 2.5× baseline → hard fail
 *
 * Baseline file: e2e/perf-baseline.json  (commit this once recorded)
 * Report artifacts: attached to each test run in the Playwright HTML report.
 *
 * Runs in both the "chromium" (demo) and "authenticated" Playwright projects.
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ── Constants ────────────────────────────────────────────────────────────────

const BASELINE_FILE = path.join(__dirname, "perf-baseline.json");
const WARN_MULT = 1.5;
const FAIL_MULT = 2.5;

// ── Types ────────────────────────────────────────────────────────────────────

type MetricMap = Record<string, number>;

interface PerformanceBaseline {
  recorded_at: string;
  demo: MetricMap;
  authenticated: MetricMap;
}

interface ReportRow {
  key: string;
  label: string;
  current: number;
  baseline: number | null;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Measure milliseconds from the start of `action` until `until` resolves.
 */
async function measureMs(
  action: () => Promise<void>,
  until: () => Promise<void>
): Promise<number> {
  const t0 = Date.now();
  await action();
  await until();
  return Date.now() - t0;
}

function loadBaseline(): Partial<PerformanceBaseline> {
  if (!fs.existsSync(BASELINE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(BASELINE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveBaseline(data: PerformanceBaseline): void {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(data, null, 2) + "\n");
}

function getStatus(current: number, baseline: number): "pass" | "warn" | "fail" {
  const r = current / baseline;
  if (r >= FAIL_MULT) return "fail";
  if (r >= WARN_MULT) return "warn";
  return "pass";
}

function buildTextReport(rows: ReportRow[], projectName: string, isFirstRun: boolean): string {
  const ts = new Date().toISOString();
  const title = `Performance Report — ${projectName} — ${ts}`;
  const lines: string[] = [title, "=".repeat(title.length), ""];

  if (isFirstRun) {
    lines.push("Mode: BASELINE RECORDING");
    lines.push(`Thresholds apply on next run: warn ≥${WARN_MULT}×, fail ≥${FAIL_MULT}×`);
    lines.push("");
    const pad = (s: string, w: number) => s.padEnd(w).slice(0, w);
    lines.push(pad("Metric", 36) + "Recorded");
    lines.push("-".repeat(50));
    for (const r of rows) {
      lines.push(pad(r.label, 36) + `${r.current}ms`);
    }
  } else {
    const pad = (s: string, w: number) => s.padEnd(w).slice(0, w);
    lines.push(
      pad("Metric", 30) +
        pad("Baseline", 11) +
        pad("Current", 11) +
        pad("Ratio", 9) +
        "Status"
    );
    lines.push("-".repeat(72));
    for (const r of rows) {
      if (r.baseline == null) {
        lines.push(pad(r.label, 30) + pad("—", 11) + pad(`${r.current}ms`, 11) + pad("—", 9) + "NEW");
        continue;
      }
      const ratio = r.current / r.baseline;
      const status = getStatus(r.current, r.baseline);
      const statusLabel =
        status === "fail" ? "❌ FAIL" : status === "warn" ? "⚠️  WARN" : "✅ PASS";
      lines.push(
        pad(r.label, 30) +
          pad(`${r.baseline}ms`, 11) +
          pad(`${r.current}ms`, 11) +
          pad(`${ratio.toFixed(2)}x`, 9) +
          statusLabel
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

// ── Metric labels ─────────────────────────────────────────────────────────────

const LABELS: Record<string, string> = {
  app_initial_load: "App initial load",
  mode_entry: "Demo mode entry (app bootstrap)",
  note_creation: "Note creation",
  note_switch: "Note switch",
  bold_toggle: "Bold toggle",
  sidebar_nav_switch: "Sidebar nav switch",
  settings_open: "Settings open",
  version_history_open: "Version history open",
};

// ── Test ──────────────────────────────────────────────────────────────────────

test.describe("Performance", () => {
  test("measure key interaction timings", async ({ page }, testInfo) => {
    const isAuth = testInfo.project.name === "authenticated";
    const projectKey = isAuth ? "authenticated" : "demo";

    await page.setViewportSize({ width: 1280, height: 800 });

    const measured: MetricMap = {};

    // ── 1. App initial load ────────────────────────────────────────────────
    // Demo:  time from page.goto("/") until the login screen is interactive.
    // Auth:  time from page.goto("/") until the app shell is ready (logged in).
    measured.app_initial_load = await measureMs(
      async () => {
        await page.goto("/");
      },
      async () => {
        if (isAuth) {
          await page.getByTestId("nav-all-notes").waitFor({ state: "visible", timeout: 30_000 });
        } else {
          await page.getByTestId("demo-mode-btn").waitFor({ state: "visible", timeout: 30_000 });
        }
      }
    );

    // ── 2. Mode entry → app shell bootstrapped ─────────────────────────────
    // Demo:  click "Enter demo mode" → demo banner visible (app shell alive).
    //        The Zustand store starts at "quickbits" so note-list is NOT the
    //        right end condition here — it only appears after nav-all-notes click.
    // Auth:  app shell is already loaded; this metric is skipped.
    if (!isAuth) {
      measured.mode_entry = await measureMs(
        async () => {
          await page.getByTestId("demo-mode-btn").click();
        },
        async () => {
          await page.getByText("You're in demo mode").waitFor({ state: "visible" });
        }
      );
      // Navigate to All Notes for subsequent steps (not part of the measurement)
      await page.getByTestId("nav-all-notes").click();
      await page.getByTestId("note-list").waitFor({ state: "visible" });
    } else {
      // For auth: ensure we're on All Notes
      await page.getByTestId("nav-all-notes").waitFor({ state: "visible" });
    }

    // ── 3. Note creation ───────────────────────────────────────────────────
    const noteCountBefore = await page.getByTestId("note-item").count();
    measured.note_creation = await measureMs(
      async () => {
        await page.getByTestId("new-note-btn").click();
      },
      async () => {
        await expect(page.getByTestId("note-item")).toHaveCount(noteCountBefore + 1);
      }
    );

    // ── 4. Note switch ─────────────────────────────────────────────────────
    // Pre-warm: open the first note
    await page.getByTestId("note-item").nth(0).click();
    await page.getByTestId("note-title-input").waitFor({ state: "visible" });
    await page.locator(".ProseMirror").waitFor({ state: "visible" });

    const noteCount = await page.getByTestId("note-item").count();
    if (noteCount >= 2) {
      measured.note_switch = await measureMs(
        async () => {
          await page.getByTestId("note-item").nth(1).click();
        },
        async () => {
          await page.getByTestId("note-title-input").waitFor({ state: "visible" });
          await page.locator(".ProseMirror").waitFor({ state: "visible" });
        }
      );
    }

    // ── 5. Bold toggle ─────────────────────────────────────────────────────
    // The editor is open from step 4. Click into it, select all, then toggle bold.
    await page.locator(".ProseMirror").waitFor({ state: "visible" });
    await page.locator(".ProseMirror").click();
    await page.keyboard.press("Meta+A");
    await page.waitForTimeout(80); // let selection settle

    const boldBtn = page.getByTestId("toolbar-bold-btn");
    await boldBtn.waitFor({ state: "visible" });

    // Ensure bold is currently off so we measure toggling ON
    const boldIsOn = (await boldBtn.getAttribute("data-state")) === "on";
    if (boldIsOn) {
      await boldBtn.click();
      await expect(boldBtn).toHaveAttribute("data-state", "off");
    }

    measured.bold_toggle = await measureMs(
      async () => {
        await boldBtn.click();
      },
      async () => {
        await expect(boldBtn).toHaveAttribute("data-state", "on");
      }
    );

    // ── 6. Sidebar nav switch ──────────────────────────────────────────────
    await page.getByTestId("nav-all-notes").click();
    await page.getByTestId("note-list").waitFor({ state: "visible" });

    measured.sidebar_nav_switch = await measureMs(
      async () => {
        await page.getByTestId("nav-quickbits").click();
      },
      async () => {
        await page.getByTestId("quickbit-item").first().waitFor({ state: "visible" });
      }
    );

    // ── 7. Settings open ───────────────────────────────────────────────────
    // Navigate away from quickbits first to avoid layout interference
    await page.getByTestId("nav-all-notes").click();
    await page.getByTestId("note-list").waitFor({ state: "visible" });

    measured.settings_open = await measureMs(
      async () => {
        await page.getByTestId("settings-btn").click();
      },
      async () => {
        await page.getByTestId("settings-modal").waitFor({ state: "visible" });
      }
    );

    // Close settings before next measurement
    await page.keyboard.press("Escape");
    await page.getByTestId("settings-modal").waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});

    // ── 8. Version history open ────────────────────────────────────────────
    // Version history button is only visible on desktop when a note is open.
    await page.getByTestId("note-item").first().click();
    await page.locator(".ProseMirror").waitFor({ state: "visible" });

    const versionBtn = page.getByTestId("version-history-btn");
    await versionBtn.waitFor({ state: "visible" });

    measured.version_history_open = await measureMs(
      async () => {
        await versionBtn.click();
      },
      async () => {
        await page.getByTestId("version-history-panel").waitFor({ state: "visible" });
      }
    );

    // ── Baseline handling ──────────────────────────────────────────────────
    const existing = loadBaseline();
    const existingProjectMetrics = existing[projectKey as keyof typeof existing] as MetricMap | undefined;
    const isFirstRun = !existingProjectMetrics || Object.keys(existingProjectMetrics).length === 0;

    const rows: ReportRow[] = Object.entries(measured).map(([key, current]) => ({
      key,
      label: LABELS[key] ?? key,
      current,
      baseline: existingProjectMetrics?.[key] ?? null,
    }));

    // ── Generate report ────────────────────────────────────────────────────
    const textReport = buildTextReport(rows, testInfo.project.name, isFirstRun);
    console.log("\n" + textReport);

    const jsonReport = JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        project: testInfo.project.name,
        is_baseline_run: isFirstRun,
        baseline_recorded_at: existing.recorded_at ?? null,
        warn_multiplier: WARN_MULT,
        fail_multiplier: FAIL_MULT,
        metrics: rows.map((r) => ({
          key: r.key,
          label: r.label,
          current_ms: r.current,
          baseline_ms: r.baseline,
          ratio: r.baseline != null ? +(r.current / r.baseline).toFixed(3) : null,
          status: r.baseline != null ? getStatus(r.current, r.baseline) : "new",
        })),
      },
      null,
      2
    );

    await testInfo.attach("perf-report.txt", { body: textReport, contentType: "text/plain" });
    await testInfo.attach("perf-report.json", { body: jsonReport, contentType: "application/json" });

    // ── Save baseline on first run ─────────────────────────────────────────
    if (isFirstRun) {
      const updated: PerformanceBaseline = {
        recorded_at: new Date().toISOString(),
        demo: projectKey === "demo" ? measured : (existing.demo ?? {}),
        authenticated:
          projectKey === "authenticated" ? measured : (existing.authenticated ?? {}),
      };
      saveBaseline(updated);
      console.log(`✅ Baseline recorded for project '${projectKey}' → ${BASELINE_FILE}`);
    }

    // ── Threshold assertions ───────────────────────────────────────────────
    // Skip in CI — the baseline was recorded on a local machine and GitHub
    // Actions runners are significantly slower.  CI still measures and attaches
    // the report as an artifact, but thresholds only apply when running locally.
    const isCI = !!process.env.CI;
    if (!isFirstRun && !isCI) {
      const warnings: string[] = [];
      const failures: string[] = [];

      for (const r of rows) {
        if (r.baseline == null) continue;
        const ratio = r.current / r.baseline;

        if (ratio >= FAIL_MULT) {
          failures.push(
            `  ${r.label}: ${r.current}ms = ${ratio.toFixed(2)}× baseline (${r.baseline}ms) — exceeds ${FAIL_MULT}× fail threshold`
          );
        } else if (ratio >= WARN_MULT) {
          warnings.push(
            `  ${r.label}: ${r.current}ms = ${ratio.toFixed(2)}× baseline (${r.baseline}ms) — exceeds ${WARN_MULT}× warn threshold`
          );
          testInfo.annotations.push({
            type: "perf-warn",
            description: `${r.label}: ${ratio.toFixed(2)}× baseline`,
          });
        }
      }

      if (warnings.length > 0) {
        console.warn("\n⚠️  Performance warnings:\n" + warnings.join("\n") + "\n");
      }

      expect(
        failures,
        `Performance regressions detected:\n${failures.join("\n")}`
      ).toHaveLength(0);
    }
  });
});
