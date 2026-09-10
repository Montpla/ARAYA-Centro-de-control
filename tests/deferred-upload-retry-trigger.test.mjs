import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("lib/deferred-upload-retry-trigger.ts", "utf8");
let recordedActivity = [];
const executableSource = source
  .replace(
    /import \{ getRequestExecutionContext \} from "vinext\/shims\/request-context";/,
    'const getRequestExecutionContext = () => undefined;',
  )
  .replace(
    /import \{ getDb \} from "\.\.\/db";/,
    'const getDb = () => globalThis.__mockDb;',
  )
  .replace(
    /import \{ fileActivity \} from "\.\.\/db\/schema";/,
    'const fileActivity = "fileActivity";',
  );
const transpiled = ts.transpileModule(executableSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`);

globalThis.__mockDb = {
  insert: () => ({
    values: (value) => {
      recordedActivity.push(value);
      return Promise.resolve();
    },
  }),
};

const originalFetch = globalThis.fetch;
const originalToken = process.env.GITHUB_ACTIONS_TOKEN;
after(() => {
  globalThis.fetch = originalFetch;
  process.env.GITHUB_ACTIONS_TOKEN = originalToken;
  delete globalThis.__mockDb;
});

test("sin token configurado no llama a la API de GitHub", () => {
  delete process.env.GITHUB_ACTIONS_TOKEN;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("fetch no debería ejecutarse sin token");
  };
  mod.triggerDeferredUploadRetry("file-1");
  assert.equal(calls, 0);
});

test("con token configurado pide el reintento inmediato al workflow real y deja constancia del éxito", async () => {
  process.env.GITHUB_ACTIONS_TOKEN = "token-de-prueba";
  recordedActivity = [];
  let url;
  let init;
  globalThis.fetch = async (u, i) => {
    url = u;
    init = i;
    return new Response(null, { status: 204 });
  };
  await mod.triggerDeferredUploadRetry("file-2");
  assert.equal(
    url,
    "https://api.github.com/repos/Montpla/ARAYA-Centro-de-control/actions/workflows/reintentar-subida-diferida.yml/dispatches",
  );
  assert.equal(init.method, "POST");
  assert.equal(init.headers.Authorization, "Bearer token-de-prueba");
  assert.deepEqual(JSON.parse(init.body), { ref: "main", inputs: { fileId: "file-2" } });
  assert.equal(recordedActivity.length, 1);
  assert.equal(recordedActivity[0].fileId, "file-2");
  assert.match(recordedActivity[0].message, /solicitado/);
});

test("un rechazo HTTP de GitHub queda registrado con el código real, sin lanzar una excepción", async () => {
  process.env.GITHUB_ACTIONS_TOKEN = "token-de-prueba";
  recordedActivity = [];
  globalThis.fetch = async () => new Response("Bad credentials", { status: 401 });
  await assert.doesNotReject(() => mod.triggerDeferredUploadRetry("file-3"));
  assert.equal(recordedActivity.length, 1);
  assert.equal(recordedActivity[0].fileId, "file-3");
  assert.match(recordedActivity[0].message, /HTTP 401/);
  assert.match(recordedActivity[0].message, /barrido programado/);
});

test("un fallo de red queda registrado y no lanza una excepción sin capturar", async () => {
  process.env.GITHUB_ACTIONS_TOKEN = "token-de-prueba";
  recordedActivity = [];
  globalThis.fetch = async () => {
    throw new Error("la red no respondió");
  };
  await assert.doesNotReject(() => mod.triggerDeferredUploadRetry("file-4"));
  assert.equal(recordedActivity.length, 1);
  assert.match(recordedActivity[0].message, /la red no respondió/);
});
