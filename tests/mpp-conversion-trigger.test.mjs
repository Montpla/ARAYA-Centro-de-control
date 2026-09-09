import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("lib/mpp-conversion-trigger.ts", "utf8");
const executableSource = source.replace(
  /import \{ getRequestExecutionContext \} from "vinext\/shims\/request-context";/,
  'const getRequestExecutionContext = () => undefined;',
);
const transpiled = ts.transpileModule(executableSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`);

const originalFetch = globalThis.fetch;
const originalToken = process.env.GITHUB_ACTIONS_TOKEN;
after(() => {
  globalThis.fetch = originalFetch;
  process.env.GITHUB_ACTIONS_TOKEN = originalToken;
});

test("sin token configurado no llama a la API de GitHub", () => {
  delete process.env.GITHUB_ACTIONS_TOKEN;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("fetch no debería ejecutarse sin token");
  };
  mod.triggerMppConversion();
  assert.equal(calls, 0);
});

test("con token configurado pide la conversión inmediata al workflow real", async () => {
  process.env.GITHUB_ACTIONS_TOKEN = "token-de-prueba";
  let url;
  let init;
  let resolveFetch;
  const fetched = new Promise((resolve) => { resolveFetch = resolve; });
  globalThis.fetch = async (u, i) => {
    url = u;
    init = i;
    resolveFetch();
    return new Response("", { status: 204 });
  };
  mod.triggerMppConversion();
  await fetched;
  assert.equal(
    url,
    "https://api.github.com/repos/Montpla/ARAYA-Centro-de-control/actions/workflows/convertir-mpp.yml/dispatches",
  );
  assert.equal(init.method, "POST");
  assert.equal(init.headers.Authorization, "Bearer token-de-prueba");
  assert.deepEqual(JSON.parse(init.body), { ref: "main", inputs: { filtro: "", aplicar: "1" } });
});

test("un fallo de red no lanza una excepción sin capturar", () => {
  process.env.GITHUB_ACTIONS_TOKEN = "token-de-prueba";
  globalThis.fetch = async () => {
    throw new Error("la red no respondió");
  };
  assert.doesNotThrow(() => mod.triggerMppConversion());
});
