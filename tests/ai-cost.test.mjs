import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("lib/ai-cost.ts", "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const cost = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`);

test("Luna is estimated at one tenth of Terra for the same token usage", () => {
  const usage = { inputTokens: 10_000, cachedInputTokens: 0, cacheWriteInputTokens: 0, outputTokens: 2_000 };
  const luna = cost.estimateOpenAiCostUsdMicros("gpt-5.6-luna", usage);
  const terra = cost.estimateOpenAiCostUsdMicros("gpt-5.6-terra", usage);
  assert.equal(luna, 4_400);
  assert.equal(terra, 44_000);
  assert.equal(terra, luna * 10);
});

test("cached input tokens use the discounted rate", () => {
  const uncached = cost.estimateOpenAiCostUsdMicros("gpt-5.6-luna", {
    inputTokens: 10_000,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 0,
  });
  const cached = cost.estimateOpenAiCostUsdMicros("gpt-5.6-luna", {
    inputTokens: 10_000,
    cachedInputTokens: 10_000,
    cacheWriteInputTokens: 0,
    outputTokens: 0,
  });
  assert.equal(uncached, 2_000);
  assert.equal(cached, 200);
});

test("Responses usage includes cache details", () => {
  assert.deepEqual(cost.readOpenAiTokenUsage({
    usage: {
      input_tokens: 321,
      input_tokens_details: { cached_tokens: 120, cache_write_tokens: 20 },
      output_tokens: 45,
    },
  }), {
    inputTokens: 321,
    cachedInputTokens: 120,
    cacheWriteInputTokens: 20,
    outputTokens: 45,
  });
});
