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

test("un fallo de saldo de IA se explica en lenguaje operativo", () => {
  const message = extraction.apiErrorMessage({
    error: { message: "You have no credits remaining. Add credits to continue using the API." },
  }, 429);
  assert.match(message, /no tiene saldo disponible/i);
  assert.match(message, /lectores deterministas siguen activos/i);
  assert.doesNotMatch(message, /https?:\/\//);
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
  assert.match(result.promptVersion, /^araya-ingestion-agent-/);
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

test("todo lo que trae evidencia y confianza positiva se publica solo, sin revisión", () => {
  assert.equal(extraction.canAutomaticallyPublishExtraction({
    model: "deterministic",
    confidence: 1,
    updateConfidences: [],
    warnings: ["El parser omitio una fila no estructurada."],
    updateCount: 1,
  }), true, "deterministic CSV/JSON remains eligible after its contract validation");

  // Por decisión del propietario ya no hay umbral de revisión: un dato con
  // evidencia y confianza positiva entra solo, aunque sea baja. La integridad la
  // garantiza el contrato vivo, no una revisión manual.
  assert.equal(extraction.canAutomaticallyPublishExtraction({
    model: "gpt-5.6-terra",
    confidence: 0.55,
    updateConfidences: [0.99, 0.35],
    warnings: [],
    updateCount: 2,
  }), true, "una confianza baja pero positiva ya no bloquea: se publica y el contrato protege la integridad");

  assert.equal(extraction.canAutomaticallyPublishExtraction({
    model: "gpt-5.6-terra",
    confidence: 0.9,
    updateConfidences: [0.9],
    warnings: ["Se omitio una fila sin evidencia verificable."],
    updateCount: 1,
  }), true, "an informational warning about discarded/unrelated content does not block the accepted proposals");

  // Confianza cero o negativa (el modelo no afirma nada) sí queda fuera: no hay
  // dato que publicar.
  assert.equal(extraction.canAutomaticallyPublishExtraction({
    model: "gpt-5.6-terra",
    confidence: 0,
    updateConfidences: [0],
    warnings: [],
    updateCount: 1,
  }), false, "sin confianza no hay afirmación que publicar");
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

test("the ingestion agent executes a bounded tool loop and returns an auditable trajectory", async () => {
  const requestBodies = [];
  let responseCalls = 0;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(init.body);
    requestBodies.push(body);
    responseCalls += 1;
    if (responseCalls === 1) {
      return new Response(JSON.stringify({
        model: "gpt-5.6-terra",
        output: [{
          type: "function_call",
          call_id: "call-template-1",
          name: "find_document_template",
          arguments: JSON.stringify({ query: "cubicacion" }),
          status: "completed",
        }],
        usage: { input_tokens: 100, output_tokens: 20 },
      }), { status: 200 });
    }
    const output = {
      updates: [{
        key: "projectSnapshot.overallProgress",
        value_json: "22.71",
        area: "obra",
        cutoff: "2026-07-31",
        source_currency: "DOP",
        confidence: 0.99,
        evidence: "Carátula, fila TOTAL, 22,71%",
      }],
      summary: "Avance contrastado tras consultar la plantilla.",
      warnings: [],
      confidence: 0.99,
      unmapped_candidates: [],
    };
    return new Response(JSON.stringify({
      model: "gpt-5.6-terra",
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }],
      usage: { input_tokens: 140, output_tokens: 60 },
    }), { status: 200 });
  };

  const result = await extraction.extractDocumentWithAI({
    ...input("png"),
    templateHints: [{
      id: "tpl-cubicacion",
      fingerprint: "abc",
      namePattern: "cubicacion-{n}-araya-{mes}",
      extension: "xlsx",
      area: "obra",
      documentType: "avance_obra",
      mappingJson: JSON.stringify([{ key: "projectSnapshot.overallProgress", area: "obra" }]),
      visualizationJson: "[]",
      promptVersion: "v1",
      successCount: 3,
      confidence: 1,
    }],
  });

  assert.equal(responseCalls, 2);
  assert.equal(requestBodies[0].tool_choice, "required");
  assert.equal(requestBodies[1].tool_choice, "auto");
  assert.ok(requestBodies[1].input.some((item) =>
    item.type === "function_call_output" && item.call_id === "call-template-1"));
  assert.equal(result.agentIterations, 2);
  assert.deepEqual(result.agentTrace.map((item) => item.name), ["find_document_template"]);
  assert.equal(result.agentTrace[0].ok, true);
  assert.equal(result.inputTokens, 240);
  assert.equal(result.outputTokens, 80);
  assert.equal(result.updates[0].value, 22.71);
});

test("the ingestion agent accepts the lookup fan-out needed by complex workbooks", async () => {
  let responseCalls = 0;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    responseCalls += 1;
    if (responseCalls === 1) {
      return new Response(JSON.stringify({
        model: "gpt-5.6-terra",
        output: Array.from({ length: 13 }, (_, index) => ({
          type: "function_call",
          call_id: `call-schema-${index}`,
          name: "inspect_live_schema",
          arguments: JSON.stringify({ root: "projectSnapshot" }),
          status: "completed",
        })),
        usage: { input_tokens: 200, output_tokens: 40 },
      }), { status: 200 });
    }
    const body = JSON.parse(init.body);
    assert.equal(body.input.filter((item) => item.type === "function_call_output").length, 13);
    const output = {
      updates: [],
      summary: "Libro contrastado sin cambios publicables.",
      warnings: [],
      confidence: 0.98,
      unmapped_candidates: [],
    };
    return new Response(JSON.stringify({
      model: "gpt-5.6-terra",
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }],
      usage: { input_tokens: 250, output_tokens: 50 },
    }), { status: 200 });
  };

  const result = await extraction.extractDocumentWithAI(input("png"));

  assert.equal(responseCalls, 2);
  assert.equal(result.agentIterations, 2);
  assert.equal(result.agentTrace.length, 13);
  assert.doesNotMatch(result.warnings.join(" "), /límite de herramientas/);
});
