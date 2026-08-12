import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("lib/ai-document-extraction.ts", "utf8");
const executableSource = source.replace(
  /import \{[\s\S]*?\} from "\.\/live-data";/,
  `const LIVE_DATA_ROOTS = [
    "projectSnapshot",
    "monthlyPlan",
    "buildings",
    "urbanismAreas",
    "urbanismReportAreas",
    "reprogrammedFlowMonths",
  ];
  const isLiveDataKey = (key) => /^(projectSnapshot|monthlyPlan|buildings|urbanismAreas|urbanismReportAreas|reprogrammedFlowMonths)(?:\\.(?:[A-Za-z][A-Za-z0-9]*|\\d+))*$/.test(key);`,
);
const transpiled = ts.transpileModule(executableSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const extraction = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`
);
const originalFetch = globalThis.fetch;

after(() => {
  globalThis.fetch = originalFetch;
});

function input(extension, bytes = new Uint8Array([1, 2, 3]).buffer) {
  return {
    bytes,
    fileName: `informe.${extension}`,
    mimeType: "application/octet-stream",
    extension,
    area: "obra",
    cutoff: "2026-07-31",
    sourceCurrency: "DOP",
    apiKey: "test-key",
  };
}

test("legacy formats return a warning without calling OpenAI", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("fetch should not run");
  };

  const result = await extraction.extractDocumentWithAI(input("dwg"));

  assert.equal(calls, 0);
  assert.deepEqual(result.updates, []);
  assert.match(result.warnings[0], /no admite \.dwg/i);
  assert.equal(result.model, "gpt-5.6-terra");
  assert.match(result.promptVersion, /^araya-live-data-extraction-/);
});

test("image extraction uses a data URL and rejects keys outside the live contract", async () => {
  let requestBody;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    requestBody = JSON.parse(init.body);
    const output = {
      updates: [
        {
          key: "projectSnapshot.overallProgress",
          value_json: "19.25",
          area: "obra",
          cutoff: "2026-07-31",
          source_currency: "DOP",
          confidence: 0.94,
          evidence: "Tabla Avance general, cifra 19,25%",
        },
        {
          key: "unknownRoot.progress",
          value_json: "99",
          area: "obra",
          cutoff: "2026-07-31",
          source_currency: "DOP",
          confidence: 0.99,
          evidence: "Texto no compatible",
        },
      ],
      summary: "Un avance explícito detectado.",
      warnings: [],
      confidence: 0.9,
    };
    return new Response(
      JSON.stringify({
        model: "gpt-5.6-terra-2026-08-01",
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await extraction.extractDocumentWithAI(input("png"));

  assert.equal(result.updates.length, 1);
  assert.equal(result.updates[0].key, "projectSnapshot.overallProgress");
  assert.equal(result.updates[0].value, 19.25);
  assert.deepEqual(result.updateConfidences, [0.94]);
  assert.equal(result.confidence, 0.9);
  assert.match(result.warnings.join(" "), /clave no compatible/i);
  assert.equal(requestBody.model, "gpt-5.6-terra");
  assert.equal(requestBody.text.format.type, "json_schema");
  assert.equal(requestBody.text.format.strict, true);
  assert.equal(requestBody.safety_identifier, "araya_document_ingestion_service");
  assert.match(requestBody.input[0].content[2].image_url, /^data:image\/png;base64,/);
});

test("automatic AI publication requires every proposal to clear a moderate confidence floor, but informational warnings alone do not block it", () => {
  assert.equal(extraction.canAutomaticallyPublishExtraction({
    model: "deterministic",
    confidence: 1,
    updateConfidences: [],
    warnings: ["El parser omitio una fila no estructurada."],
    updateCount: 1,
  }), true, "deterministic CSV/JSON remains eligible after its contract validation");

  assert.equal(extraction.canAutomaticallyPublishExtraction({
    model: "gpt-5.6-terra",
    confidence: 0.55,
    updateConfidences: [0.99, 0.35],
    warnings: [],
    updateCount: 2,
  }), false, "a high global average cannot hide one proposal below the confidence floor");

  assert.equal(extraction.canAutomaticallyPublishExtraction({
    model: "gpt-5.6-terra",
    confidence: 0.9,
    updateConfidences: [0.9],
    warnings: ["Se omitio una fila sin evidencia verificable."],
    updateCount: 1,
  }), true, "an informational warning about discarded/unrelated content does not block the accepted proposals");

  assert.equal(extraction.canAutomaticallyPublishExtraction({
    model: "gpt-5.6-terra",
    confidence: 0.55,
    updateConfidences: [0.55, 0.6],
    warnings: [],
    updateCount: 2,
  }), true, "moderate confidence at or above the floor is enough, it no longer requires 0.8+");
});

test("uploaded files use purpose user_data and are deleted after a Responses API error", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url === "https://api.openai.com/v1/files" && init.method === "POST") {
      assert.equal(init.body.get("purpose"), "user_data");
      assert.ok(init.body.get("file") instanceof Blob);
      return new Response(JSON.stringify({ id: "file-temporary-123" }), { status: 200 });
    }
    if (url === "https://api.openai.com/v1/responses") {
      const body = JSON.parse(init.body);
      assert.equal(body.input[0].content[2].type, "input_file");
      assert.equal(body.input[0].content[2].file_id, "file-temporary-123");
      return new Response(JSON.stringify({ error: { message: "Fallo temporal controlado" } }), {
        status: 500,
      });
    }
    if (url === "https://api.openai.com/v1/files/file-temporary-123" && init.method === "DELETE") {
      return new Response(JSON.stringify({ id: "file-temporary-123", deleted: true }), {
        status: 200,
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const result = await extraction.extractDocumentWithAI(input("xlsx"));

  assert.deepEqual(result.updates, []);
  assert.match(result.warnings.join(" "), /Fallo temporal controlado/);
  assert.deepEqual(
    calls.map(({ url, init }) => `${init.method}:${url}`),
    [
      "POST:https://api.openai.com/v1/files",
      "POST:https://api.openai.com/v1/responses",
      "DELETE:https://api.openai.com/v1/files/file-temporary-123",
    ],
  );
});
