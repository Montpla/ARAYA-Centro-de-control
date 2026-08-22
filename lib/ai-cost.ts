export type AiTokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
};

type ModelPrice = {
  input: number;
  cachedInput: number;
  cacheWriteInput: number;
  output: number;
};

// USD por millÃ³n de tokens. Centralizar la tarifa evita estimaciones distintas
// entre el agente de documentos, el chat y el panel de administraciÃ³n.
const MODEL_PRICES: Record<"luna" | "terra", ModelPrice> = {
  luna: { input: 0.2, cachedInput: 0.02, cacheWriteInput: 0.25, output: 1.2 },
  terra: { input: 2, cachedInput: 0.2, cacheWriteInput: 2.5, output: 12 },
};

function finiteInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function emptyAiTokenUsage(): AiTokenUsage {
  return { inputTokens: 0, cachedInputTokens: 0, cacheWriteInputTokens: 0, outputTokens: 0 };
}

export function readOpenAiTokenUsage(payload: unknown): AiTokenUsage {
  const root = record(payload);
  const usage = record(root?.usage);
  const inputDetails = record(usage?.input_tokens_details);
  const cachedInputTokens = finiteInteger(inputDetails?.cached_tokens);
  const cacheWriteInputTokens = finiteInteger(
    inputDetails?.cache_write_tokens
      ?? inputDetails?.cache_creation_tokens
      ?? usage?.cache_write_input_tokens,
  );
  return {
    inputTokens: finiteInteger(usage?.input_tokens),
    cachedInputTokens,
    cacheWriteInputTokens,
    outputTokens: finiteInteger(usage?.output_tokens),
  };
}

export function addAiTokenUsage(left: AiTokenUsage, right: AiTokenUsage): AiTokenUsage {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    cachedInputTokens: left.cachedInputTokens + right.cachedInputTokens,
    cacheWriteInputTokens: left.cacheWriteInputTokens + right.cacheWriteInputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
  };
}

export function modelPriceFamily(model: string): "luna" | "terra" | null {
  const normalized = String(model ?? "").toLowerCase();
  if (normalized.startsWith("gpt-5.6-luna")) return "luna";
  if (normalized.startsWith("gpt-5.6-terra")) return "terra";
  return null;
}

export function estimateOpenAiCostUsdMicros(model: string, usage: AiTokenUsage) {
  const family = modelPriceFamily(model);
  if (!family) return 0;
  const price = MODEL_PRICES[family];
  const cached = Math.min(usage.inputTokens, usage.cachedInputTokens);
  const cacheWrite = Math.min(
    Math.max(0, usage.inputTokens - cached),
    usage.cacheWriteInputTokens,
  );
  const regular = Math.max(0, usage.inputTokens - cached - cacheWrite);
  // USD/MTok * tokens equivale a microdÃ³lares.
  return Math.round(
    regular * price.input
      + cached * price.cachedInput
      + cacheWrite * price.cacheWriteInput
      + usage.outputTokens * price.output,
  );
}

export function usdMicrosToUsd(value: number) {
  return Math.max(0, Number(value) || 0) / 1_000_000;
}
