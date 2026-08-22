import { eq, gte } from "drizzle-orm";
import { getDb } from "../db";
import { aiUsageSettings, assistantAiRuns, ingestionAgentRuns } from "../db/schema";
import { modelPriceFamily } from "./ai-cost";

export type AiUsageSnapshot = {
  month: string;
  documentRuns: number;
  assistantRuns: number;
  deterministicRuns: number;
  lunaRuns: number;
  terraRuns: number;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  estimatedCostUsdMicros: number;
  monthlyBudgetUsdMicros: number;
  remainingBudgetUsdMicros: number | null;
  budgetPercent: number | null;
  blocked: boolean;
};

type RunUsage = {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  estimatedCostUsdMicros: number;
};

function monthStart(now = new Date()) {
  return `${now.toISOString().slice(0, 7)}-01 00:00:00`;
}

function initialSnapshot(now = new Date()): AiUsageSnapshot {
  return {
    month: now.toISOString().slice(0, 7),
    documentRuns: 0,
    assistantRuns: 0,
    deterministicRuns: 0,
    lunaRuns: 0,
    terraRuns: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 0,
    estimatedCostUsdMicros: 0,
    monthlyBudgetUsdMicros: 0,
    remainingBudgetUsdMicros: null,
    budgetPercent: null,
    blocked: false,
  };
}

function addRuns(snapshot: AiUsageSnapshot, rows: RunUsage[]) {
  rows.forEach((row) => {
    const family = modelPriceFamily(row.model);
    if (family === "luna") snapshot.lunaRuns += 1;
    else if (family === "terra") snapshot.terraRuns += 1;
    else snapshot.deterministicRuns += 1;
    snapshot.inputTokens += row.inputTokens;
    snapshot.cachedInputTokens += row.cachedInputTokens;
    snapshot.cacheWriteInputTokens += row.cacheWriteInputTokens;
    snapshot.outputTokens += row.outputTokens;
    snapshot.estimatedCostUsdMicros += row.estimatedCostUsdMicros;
  });
}

export async function getAiUsageSnapshot(now = new Date()): Promise<AiUsageSnapshot> {
  const snapshot = initialSnapshot(now);
  try {
    const db = getDb();
    const [documents, assistant, settings] = await Promise.all([
      db.select({
        model: ingestionAgentRuns.model,
        inputTokens: ingestionAgentRuns.inputTokens,
        cachedInputTokens: ingestionAgentRuns.cachedInputTokens,
        cacheWriteInputTokens: ingestionAgentRuns.cacheWriteInputTokens,
        outputTokens: ingestionAgentRuns.outputTokens,
        estimatedCostUsdMicros: ingestionAgentRuns.estimatedCostUsdMicros,
      }).from(ingestionAgentRuns).where(gte(ingestionAgentRuns.startedAt, monthStart(now))),
      db.select({
        model: assistantAiRuns.model,
        inputTokens: assistantAiRuns.inputTokens,
        cachedInputTokens: assistantAiRuns.cachedInputTokens,
        cacheWriteInputTokens: assistantAiRuns.cacheWriteInputTokens,
        outputTokens: assistantAiRuns.outputTokens,
        estimatedCostUsdMicros: assistantAiRuns.estimatedCostUsdMicros,
      }).from(assistantAiRuns).where(gte(assistantAiRuns.startedAt, monthStart(now))),
      db.select().from(aiUsageSettings).where(eq(aiUsageSettings.id, "global")).limit(1),
    ]);
    snapshot.documentRuns = documents.length;
    snapshot.assistantRuns = assistant.length;
    addRuns(snapshot, documents);
    addRuns(snapshot, assistant);
    snapshot.monthlyBudgetUsdMicros = settings[0]?.monthlyBudgetUsdMicros ?? 0;
    if (snapshot.monthlyBudgetUsdMicros > 0) {
      snapshot.remainingBudgetUsdMicros = Math.max(
        0,
        snapshot.monthlyBudgetUsdMicros - snapshot.estimatedCostUsdMicros,
      );
      snapshot.budgetPercent = Math.round(
        snapshot.estimatedCostUsdMicros / snapshot.monthlyBudgetUsdMicros * 10_000,
      ) / 100;
      snapshot.blocked = snapshot.estimatedCostUsdMicros >= snapshot.monthlyBudgetUsdMicros;
    }
  } catch {
    // Mantiene operativos los despliegues escalonados mientras D1 aplica la
    // migraciÃ³n. Sin una lectura fiable nunca bloqueamos el procesamiento.
  }
  return snapshot;
}

export async function setAiMonthlyBudget(input: {
  monthlyBudgetUsdMicros: number;
  updatedByEmail: string;
  updatedByName: string;
}) {
  const value = Math.max(0, Math.round(input.monthlyBudgetUsdMicros));
  const now = new Date().toISOString();
  await getDb().insert(aiUsageSettings).values({
    id: "global",
    monthlyBudgetUsdMicros: value,
    updatedByEmail: input.updatedByEmail,
    updatedByName: input.updatedByName,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: aiUsageSettings.id,
    set: {
      monthlyBudgetUsdMicros: value,
      updatedByEmail: input.updatedByEmail,
      updatedByName: input.updatedByName,
      updatedAt: now,
    },
  });
}

export async function recordAssistantAiRun(input: {
  id?: string;
  userEmail: string;
  userName: string;
  mode: "normal" | "advanced" | "deterministic";
  status: "completed" | "error" | "budget_blocked";
  model: string;
  turns: number;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  estimatedCostUsdMicros: number;
  error?: string;
}) {
  try {
    const now = new Date().toISOString();
    await getDb().insert(assistantAiRuns).values({
      id: input.id ?? crypto.randomUUID(),
      userEmail: input.userEmail,
      userName: input.userName,
      mode: input.mode,
      status: input.status,
      model: input.model,
      turns: input.turns,
      inputTokens: input.inputTokens,
      cachedInputTokens: input.cachedInputTokens,
      cacheWriteInputTokens: input.cacheWriteInputTokens,
      outputTokens: input.outputTokens,
      estimatedCostUsdMicros: input.estimatedCostUsdMicros,
      error: String(input.error ?? "").slice(0, 500),
      startedAt: now,
      completedAt: now,
    });
  } catch {
    // La telemetrÃ­a nunca debe impedir una respuesta al usuario.
  }
}
