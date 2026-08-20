import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { progressBandClass, progressBandDefinitions } from "../lib/progress-palette.ts";

test("progress palette classifies every boundary deterministically", () => {
  const cases = [
    [null, "progress-none"],
    [undefined, "progress-none"],
    [Number.NaN, "progress-none"],
    [-8, "progress-0"],
    [0, "progress-0"],
    [0.01, "progress-1-20"],
    [1, "progress-1-20"],
    [20, "progress-1-20"],
    [20.01, "progress-21-40"],
    [21, "progress-21-40"],
    [40, "progress-21-40"],
    [40.01, "progress-41-60"],
    [41, "progress-41-60"],
    [60, "progress-41-60"],
    [60.01, "progress-61-80"],
    [61, "progress-61-80"],
    [80, "progress-61-80"],
    [80.01, "progress-81-99"],
    [81, "progress-81-99"],
    [99.99, "progress-81-99"],
    [100, "progress-100"],
    [140, "progress-100"],
  ];

  for (const [value, expected] of cases) {
    assert.equal(progressBandClass(value), expected, `${String(value)} must map to ${expected}`);
  }
  assert.equal(progressBandDefinitions.length, 7);
});

test("maps, cards and inspectors share progress fill while blockage remains an independent signal", async () => {
  const [dashboard, styles] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
  ]);

  assert.match(dashboard, /return `\$\{progressBandClass\(unitOverallProgress\(unit\)\)\}\$\{blocked\}`/);
  assert.match(dashboard, /plan-building-trigger \$\{buildingProgressBand\}/);
  assert.match(dashboard, /plan-unit \$\{unitProgressClasses\(unit\)\}/);
  assert.match(dashboard, /unit-card interactive \$\{unitProgressClasses\(unit\)\}/);
  assert.match(dashboard, /housing-card \$\{unitProgressClasses\(unit\)\}/);
  assert.match(dashboard, /data-detail-panel \$\{unitProgressClasses\(unit\)\}/);
  assert.match(styles, /\.plan-home-statuses \.is-blocked\s*\{[^}]*outline: 2px solid #9f2f2d/s);
  assert.match(styles, /\.unit-card\.is-blocked,[\s\S]*?outline: 3px solid var\(--red\)/);
  assert.match(styles, /\.building-tabs button\.active\s*\{[^}]*outline: 2px solid var\(--ink\)/s);
  assert.doesNotMatch(styles, /\.plan-building-trigger\.(?:done|active|pending)/);
  assert.doesNotMatch(styles, /\.housing-card\.terminada/);
});

test("all progress fills provide readable text contrast", async () => {
  const styles = await readFile("app/globals.css", "utf8");
  const luminance = (hex) => {
    const channels = hex.match(/[a-f\d]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
    const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const contrast = (left, right) => {
    const [bright, dark] = [luminance(left), luminance(right)].sort((a, b) => b - a);
    return (bright + 0.05) / (dark + 0.05);
  };

  for (const band of progressBandDefinitions) {
    const block = styles.match(new RegExp(`\\.${band.id}\\s*\\{([^}]+)\\}`))?.[1];
    assert.ok(block, `${band.id} must define CSS variables`);
    const fill = block.match(/--progress-color:\s*(#[a-f\d]{6})/i)?.[1];
    const text = block.match(/--progress-contrast:\s*(#[a-f\d]{6})/i)?.[1];
    assert.ok(fill && text, `${band.id} must define fill and text colors`);
    assert.ok(contrast(fill, text) >= 4.5, `${band.id} contrast must reach WCAG AA`);
  }
});
