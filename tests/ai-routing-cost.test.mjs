import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

const [agent, files, controlApi, controlPanel, schema] = await Promise.all([
  readFile("app/api/agent/route.ts", "utf8"),
  readFile("app/api/files/route.ts", "utf8"),
  readFile("app/api/control-room/route.ts", "utf8"),
  readFile("app/control-room-panel.tsx", "utf8"),
  readFile("db/schema.ts", "utf8"),
]);

test("ARAYA Assistant uses Luna normally and Terra only in admin advanced mode", () => {
  assert.match(agent, /ASSISTANT_PRIMARY_MODEL = "gpt-5\.6-luna"/);
  assert.match(agent, /ASSISTANT_ADVANCED_MODEL = "gpt-5\.6-terra"/);
  assert.match(agent, /payload\.advanced === true && auth\.user\.role === "admin"/);
  assert.match(agent, /const maxTurns = advanced \? 3 : 2/);
  assert.match(agent, /service_tier: "default"/);
  assert.match(agent, /if \(turn \+ 1 >= maxTurns\) break/);
  assert.doesNotMatch(agent, /process\.env\.OPENAI_MODEL/);
});

test("known spreadsheets remain deterministic while narrative formats use the model cascade", () => {
  const narrativeSet = files.match(/const extensionesNarrativas = new Set\((\[[^;]+\])\)/)?.[1] ?? "";
  assert.match(narrativeSet, /"pdf"/);
  assert.match(narrativeSet, /"pptx"/);
  assert.match(narrativeSet, /"docx"/);
  assert.doesNotMatch(narrativeSet, /"xlsx?"/);
  assert.match(files, /model: INGESTION_PRIMARY_MODEL/);
  assert.match(files, /shouldEscalateDocumentExtraction/);
  assert.match(files, /model: INGESTION_ESCALATION_MODEL/);
});

test("administrators can see costs, set a budget and receive a guarded service", () => {
  assert.match(controlApi, /operation === "set_ai_budget"/);
  assert.match(controlApi, /auth\.role !== "admin"/);
  assert.match(controlPanel, /Uso de IA/);
  assert.match(controlPanel, /Presupuesto mensual máximo/);
  assert.match(schema, /assistant_ai_runs/);
  assert.match(schema, /monthly_budget_usd_micros/);
});
