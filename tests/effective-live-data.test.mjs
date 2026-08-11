import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as demoData from "../app/demo-data.ts";
import * as liveData from "../lib/live-data.ts";

async function loadSpatialIdentityResolver() {
  const source = await readFile(new URL("../lib/spatial-identity-upsert.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  const require = (specifier) => {
    if (specifier === "./live-data") return liveData;
    if (specifier === "../app/demo-data") return demoData;
    throw new Error(`Unexpected import: ${specifier}`);
  };
  vm.runInNewContext(output, {
    module: compiledModule,
    exports: compiledModule.exports,
    require,
    console,
    JSON,
    Map,
    Set,
  });
  return compiledModule.exports.resolveSpatialIdentityUpdates;
}

async function loadCore() {
  const source = await readFile(new URL("../lib/effective-live-data.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  const schemaStub = new Proxy({}, { get: () => ({}) });
  const require = (specifier) => {
    if (specifier === "./live-data") return liveData;
    if (specifier === "drizzle-orm") return { desc: (value) => value, eq: () => ({}), sql: () => ({}) };
    if (specifier === "../db") return { getDb: () => { throw new Error("DB not used in core test"); } };
    if (specifier === "../db/schema") return schemaStub;
    throw new Error(`Unexpected import: ${specifier}`);
  };
  vm.runInNewContext(output, {
    module: compiledModule,
    exports: compiledModule.exports,
    require,
    console,
    JSON,
    Map,
    Set,
  });
  return compiledModule.exports;
}

async function loadRecoveryCore() {
  const source = await readFile(new URL("../lib/live-data-publication-recovery.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, {
    module: compiledModule,
    exports: compiledModule.exports,
    console,
    Date,
    Map,
    Number,
    Set,
  });
  return compiledModule.exports;
}

async function loadLifecycleRecoveryCore() {
  const source = await readFile(new URL("../lib/file-lifecycle-recovery.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, {
    module: compiledModule,
    exports: compiledModule.exports,
    console,
    Date,
    Number,
  });
  return compiledModule.exports;
}

async function loadContractCore() {
  const source = await readFile(new URL("../lib/live-data-contract.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  const bootstrap = {
    operations: {
      projectSnapshot: {
        overallProgress: 18,
        status: "en_curso",
        cutoff: "2026-06-30",
      },
      apartments: [
        { id: "TH-01", progress: 10, status: "en_curso" },
        { id: "TH-02", progress: 20, status: "terminado" },
      ],
      monthlyPlan: [
        { month: "jun 26", planned: 21.24, actual: 18.23 },
      ],
      buildings: [{
        id: "edificio-1",
        name: "Edificio 1",
        shortName: "1",
        progress: 20,
        planProgress: null,
        deviationDays: 0,
        forecastFinish: "2027-05-31",
        units: [{
          id: "1-101",
          code: "1-101",
          floor: 1,
          progress: 20,
          status: "en_curso",
          phase: "Superestructura",
          deviationDays: 0,
          responsible: "Obra",
          lastUpdated: "2026-08-11",
          source: "Informe",
          disciplines: [],
          issues: [],
        }],
      }],
      urbanismAreas: [{
        id: "urban-roads",
        name: "Viales",
        category: "Infraestructura",
        progress: 10,
        planned: 12,
        status: "integrado",
        source: "Informe",
        detail: "Viales interiores",
        pendingFields: [],
      }],
    },
  };
  const require = (specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "./dashboard-bootstrap") {
      return { buildDashboardBootstrap: () => bootstrap };
    }
    if (specifier === "./live-data") {
      return {
        LIVE_DATA_ROOTS: [
          "projectSnapshot",
          "apartments",
          "monthlyPlan",
          "buildings",
          "urbanismAreas",
        ],
        materializeLiveRoot: liveData.materializeLiveRoot,
      };
    }
    throw new Error(`Unexpected import: ${specifier}`);
  };
  vm.runInNewContext(output, {
    module: compiledModule,
    exports: compiledModule.exports,
    require,
    console,
    Date,
    JSON,
    Map,
    Number,
    Object,
    RegExp,
    Set,
  });
  return compiledModule.exports;
}

function row(overrides = {}) {
  return {
    historyId: 1,
    eventId: 1,
    key: "projectSnapshot.overallProgress",
    valueJson: "10",
    valueType: "number",
    area: "obra",
    sourceFileId: "legacy-source",
    sourceName: "Fuente legacy",
    sourceCurrency: "DOP",
    cutoff: "2026-06-30",
    actorEmail: "obra@example.com",
    actorName: "Obra",
    createdAt: "2026-07-01T00:00:00.000Z",
    eventSourceFileId: "legacy-source",
    eventSourceName: "Fuente legacy",
    eventArea: "obra",
    eventCutoff: "2026-06-30",
    eventChangeCount: 1,
    eventMessage: "Dato publicado",
    eventStatus: "published",
    eventActorName: "Obra",
    eventCreatedAt: "2026-07-01T00:00:00.000Z",
    linkedFileId: null,
    linkedFileDeletedAt: null,
    linkedFileArea: null,
    linkedFileDocumentType: null,
    ...overrides,
  };
}

test("effective live view ignores uncommitted revisions and reverses delete/restore", async () => {
  const { deriveEffectiveLiveDataSnapshot } = await loadCore();
  const olderLegacy = row();
  const deletedWinner = row({
    historyId: 2,
    eventId: 2,
    valueJson: "20",
    sourceFileId: "file-1",
    linkedFileId: "file-1",
    linkedFileDeletedAt: "2026-08-11T10:00:00.000Z",
  });
  const preparing = row({
    historyId: 3,
    eventId: 3,
    valueJson: "30",
    sourceFileId: "",
    linkedFileId: null,
    eventStatus: "preparing",
  });

  const afterDelete = deriveEffectiveLiveDataSnapshot(
    [preparing, deletedWinner, olderLegacy],
    true,
  );
  assert.equal(afterDelete.values[olderLegacy.key], 10);
  assert.equal(afterDelete.revision, 1);

  const restoredWinner = { ...deletedWinner, linkedFileDeletedAt: "" };
  const afterRestore = deriveEffectiveLiveDataSnapshot(
    [preparing, restoredWinner, olderLegacy],
    true,
  );
  assert.equal(afterRestore.values[olderLegacy.key], 20);
  assert.equal(afterRestore.revision, 2);
});

test("non-finance snapshots redact commercial data and protected provenance", async () => {
  const { deriveEffectiveLiveDataSnapshot } = await loadCore();
  const operational = row({ key: "monthlyPlan", valueJson: "[]" });
  const commercial = row({
    historyId: 2,
    eventId: 2,
    key: "salesModels",
    valueJson: "[]",
    area: "comercial",
    eventArea: "comercial",
  });
  const mixed = row({
    historyId: 3,
    eventId: 3,
    key: "juneReport",
    valueJson: JSON.stringify({ safety: { accidents: 0 }, sales: { reservations: 12 } }),
    sourceFileId: "finance-file",
    linkedFileId: "finance-file",
    linkedFileDeletedAt: "",
    linkedFileArea: "finanzas",
    linkedFileDocumentType: "estado_financiero",
  });

  const publicSnapshot = deriveEffectiveLiveDataSnapshot([mixed, commercial, operational], false);
  const publicValues = JSON.parse(JSON.stringify(publicSnapshot.values));
  assert.deepEqual(publicValues.monthlyPlan, []);
  assert.deepEqual(publicValues.juneReport, { safety: { accidents: 0 } });
  assert.equal(publicValues.salesModels, undefined);
  assert.equal(publicSnapshot.latestEvent.sourceName, "Actualizacion protegida");
  assert.equal(publicSnapshot.points.find((point) => point.key === "juneReport").sourceFileId, "");

  const financeSnapshot = deriveEffectiveLiveDataSnapshot([mixed, commercial, operational], true);
  assert.deepEqual(JSON.parse(JSON.stringify(financeSnapshot.values.salesModels)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(financeSnapshot.values.juneReport.sales)), { reservations: 12 });
});

test("published history excludes preparing/compensated and protects commercial rows", async () => {
  const { sanitizePublishedHistoryRows } = await loadCore();
  const operational = row();
  const commercial = row({
    historyId: 2,
    eventId: 2,
    key: "salesLocations",
    valueJson: "[]",
    area: "comercial",
    eventArea: "comercial",
  });
  const compensated = row({
    historyId: 3,
    eventId: 3,
    eventStatus: "compensated",
  });
  const visible = sanitizePublishedHistoryRows([compensated, commercial, operational], false);
  assert.deepEqual(visible.map((item) => item.historyId), [1]);
});

test("a legacy neutral mixed event stays provenance-protected after its financial sibling is overwritten", async () => {
  const {
    deriveEffectiveLiveDataSnapshot,
    sanitizePublishedHistoryRows,
  } = await loadCore();
  const mixedOperational = row({
    historyId: 20,
    eventId: 20,
    key: "monthlyPlan",
    valueJson: "[]",
    sourceName: "Balance confidencial.xlsx",
    actorEmail: "finanzas@example.com",
    actorName: "Responsable Finanzas",
    eventSourceName: "Balance confidencial.xlsx",
    eventMessage: "Balance y avance operativo publicados",
    eventActorName: "Responsable Finanzas",
  });
  const protectedSibling = row({
    ...mixedOperational,
    historyId: 21,
    key: "advances",
    valueJson: "[]",
    area: "finanzas",
  });
  const laterFinancialWinner = row({
    historyId: 22,
    eventId: 22,
    key: "advances",
    valueJson: "[]",
    area: "finanzas",
    eventArea: "finanzas",
  });

  // The SQL reader annotates the remaining exact winner from all sibling
  // history, even though the financial sibling is no longer a current winner.
  const snapshot = deriveEffectiveLiveDataSnapshot([
    laterFinancialWinner,
    { ...mixedOperational, eventContainsProtectedHistory: true },
  ], false);
  const point = snapshot.points.find((item) => item.key === "monthlyPlan");
  assert.equal(point.sourceName, "Actualizacion protegida");
  assert.equal(point.updatedByEmail, "");
  assert.equal(point.updatedByName, "Usuario autorizado");
  assert.equal(snapshot.latestEvent.message.includes("Balance"), false);
  assert.equal(snapshot.latestEvent.actorName, "Usuario autorizado");

  const history = sanitizePublishedHistoryRows([
    laterFinancialWinner,
    protectedSibling,
    mixedOperational,
  ], false);
  const publicMixedRow = history.find((item) => item.historyId === 20);
  assert.equal(publicMixedRow.sourceName, "Actualizacion protegida");
  assert.equal(publicMixedRow.actorEmail, "");
  assert.equal(publicMixedRow.actorName, "Usuario autorizado");
  assert.equal(publicMixedRow.eventSourceName, "Actualizacion protegida");
  assert.equal(publicMixedRow.eventMessage.includes("Balance"), false);
  assert.equal(publicMixedRow.eventActorName, "Usuario autorizado");
});

test("latest published event remains monotonic for delete/restore lifecycle events", async () => {
  const { selectLatestVisiblePublishedEvent } = await loadCore();
  const lifecycleEvent = {
    id: 9,
    sourceFileId: "file-1",
    sourceName: "Avance de obra.xlsx",
    area: "obra",
    cutoff: "2026-08-11",
    changeCount: 4,
    message: "Archivo retirado y cuatro claves recalculadas.",
    actorName: "DirecciÃ³n",
    createdAt: "2026-08-11T12:00:00.000Z",
    status: "published",
    linkedFileArea: "obra",
    linkedFileDocumentType: "avance_obra",
  };
  const protectedEvent = {
    ...lifecycleEvent,
    id: 10,
    area: "comercial",
    linkedFileArea: "comercial",
    linkedFileDocumentType: "ventas_cobranza",
  };
  const legacyNeutralEventWithProtectedHistory = {
    ...lifecycleEvent,
    id: 11,
    sourceFileId: "legacy-missing-file",
    sourceName: "Balance confidencial.xlsx",
    area: "direccion",
    linkedFileArea: null,
    linkedFileDocumentType: null,
    containsProtectedHistory: true,
  };

  assert.equal(
    selectLatestVisiblePublishedEvent([
      legacyNeutralEventWithProtectedHistory,
      protectedEvent,
      lifecycleEvent,
    ], false).id,
    9,
  );
  assert.equal(
    selectLatestVisiblePublishedEvent([
      legacyNeutralEventWithProtectedHistory,
      protectedEvent,
      lifecycleEvent,
    ], true).id,
    11,
  );
});

test("central redactor inspects source records and notes plus issue detail", () => {
  const sources = [
    {
      id: "source-june-consolidated",
      kind: "Informe mensual",
      file: "informe-general.pptx",
      records: "Resumen consolidado",
      notes: ["Fuente mixta protegida"],
    },
    {
      id: "source-hidden-records",
      kind: "Informe mensual",
      file: "informe-general.pptx",
      records: "37 laminas con ventas y finanzas",
      notes: ["Incluye presupuesto reservado"],
    },
    {
      id: "source-june-works",
      kind: "Informe de obra",
      file: "obra-junio.pptx",
      records: "Avance y seguridad",
      notes: ["Sin importes"],
    },
  ];
  const issues = [
    { title: "Conciliacion", detail: "Diferencia en cuentas por pagar" },
    { title: "Plan fisico", detail: "Diferencia de tres puntos de avance" },
  ];

  const publicSources = liveData.redactFinancialFields("dataSources", sources);
  const publicIssues = liveData.redactFinancialFields("juneDataQualityIssues", issues);
  assert.deepEqual(JSON.parse(JSON.stringify(publicSources)), [sources[2]]);
  assert.deepEqual(JSON.parse(JSON.stringify(publicIssues)), [issues[1]]);
});

test("a newer complete root invalidates an older child override", async () => {
  const { deriveEffectiveLiveDataSnapshot } = await loadCore();
  const olderChild = row({
    historyId: 9,
    eventId: 9,
    key: "projectSnapshot.overallProgress",
    valueJson: "18",
  });
  const newerRoot = row({
    historyId: 10,
    eventId: 10,
    key: "projectSnapshot",
    valueJson: JSON.stringify({ overallProgress: 20, status: "en curso" }),
  });

  const snapshot = deriveEffectiveLiveDataSnapshot([olderChild, newerRoot], true);
  assert.equal(snapshot.values[olderChild.key], undefined);
  const materialized = liveData.materializeLiveRoot("projectSnapshot", {}, snapshot.values);
  assert.equal(materialized.overallProgress, 20);
});

test("a newer child remains an intentional patch over an older complete root", async () => {
  const { deriveEffectiveLiveDataSnapshot } = await loadCore();
  const olderRoot = row({
    historyId: 9,
    eventId: 9,
    key: "projectSnapshot",
    valueJson: JSON.stringify({ overallProgress: 20, status: "en curso" }),
  });
  const newerChild = row({
    historyId: 10,
    eventId: 10,
    key: "projectSnapshot.overallProgress",
    valueJson: "22",
  });

  const snapshot = deriveEffectiveLiveDataSnapshot([newerChild, olderRoot], true);
  const materialized = liveData.materializeLiveRoot("projectSnapshot", {}, snapshot.values);
  assert.equal(materialized.overallProgress, 22);
  assert.equal(materialized.status, "en curso");
});

test("delete and restore re-evaluate root-child recency deterministically", async () => {
  const { deriveEffectiveLiveDataSnapshot } = await loadCore();
  const olderChild = row({
    historyId: 9,
    eventId: 9,
    key: "projectSnapshot.overallProgress",
    valueJson: "18",
  });
  const root = row({
    historyId: 10,
    eventId: 10,
    key: "projectSnapshot",
    valueJson: JSON.stringify({ overallProgress: 20 }),
    sourceFileId: "root-file",
    linkedFileId: "root-file",
    linkedFileDeletedAt: "2026-08-11T12:00:00.000Z",
  });

  const afterDelete = deriveEffectiveLiveDataSnapshot([root, olderChild], true);
  assert.equal(
    liveData.materializeLiveRoot("projectSnapshot", {}, afterDelete.values).overallProgress,
    18,
  );

  const afterRestore = deriveEffectiveLiveDataSnapshot([
    { ...root, linkedFileDeletedAt: "" },
    olderChild,
  ], true);
  assert.equal(
    liveData.materializeLiveRoot("projectSnapshot", {}, afterRestore.values).overallProgress,
    20,
  );
});

test("spatial target arrays remove holes and reconcile objects by stable identity", () => {
  const base = { id: "base", progress: 0 };
  const appendedA = { id: "A", progress: 10 };
  const appendedB = { id: "B", progress: 20 };
  const appendedC = { id: "C", progress: 30 };
  const target = [base];
  const targets = { buildings: target };

  liveData.applyLiveValuesToTargets({
    "buildings.1": appendedA,
    "buildings.2": appendedB,
  }, targets);
  const selectedA = target.find((item) => item.id === "A");
  const selectedB = target.find((item) => item.id === "B");
  assert.deepEqual(target.map((item) => item.id), ["base", "A", "B"]);

  liveData.applyLiveValuesToTargets({ "buildings.2": appendedB }, targets);
  assert.deepEqual(target.map((item) => item.id), ["base", "B"]);
  assert.equal(selectedA.id, "A");
  assert.equal(target.includes(selectedA), false);
  assert.equal(target.find((item) => item.id === "B"), selectedB);

  liveData.applyLiveValuesToTargets({
    "buildings.2": appendedB,
    "buildings.3": appendedC,
  }, targets);
  assert.deepEqual(target.map((item) => item.id), ["base", "B", "C"]);
  assert.equal(selectedA.id, "A", "a removed object must never be aliased into C");

  liveData.applyLiveValuesToTargets({
    "buildings.1": appendedA,
    "buildings.2": appendedB,
    "buildings.3": appendedC,
  }, targets);
  const restoredA = target.find((item) => item.id === "A");
  assert.deepEqual(target.map((item) => item.id), ["base", "A", "B", "C"]);
  assert.notEqual(restoredA, selectedA);
  assert.equal(target.find((item) => item.id === "B"), selectedB);

  liveData.applyLiveValuesToTargets({
    "buildings.1": appendedA,
    "buildings.2": appendedB,
  }, targets);
  assert.deepEqual(target.map((item) => item.id), ["base", "A", "B"]);
  assert.equal(target.length, 3);
});

test("stale preparing cache revisions are rebuilt from the published winner", async () => {
  const { planStalePublicationRecovery } = await loadRecoveryCore();
  const canonical = {
    key: "projectSnapshot.overallProgress",
    revision: 11,
    valueJson: "18",
    valueType: "number",
    area: "obra",
    sourceFileId: "file-11",
    sourceName: "Avance publicado.xlsx",
    sourceCurrency: "DOP",
    cutoff: "2026-08-10",
    updatedByEmail: "obra@example.com",
    updatedByName: "Obra",
    updatedAt: "2026-08-10T10:00:00.000Z",
  };
  const plan = planStalePublicationRecovery({
    points: [{ key: canonical.key, revision: 12 }],
    events: [{
      id: 12,
      status: "preparing",
      createdAt: "2026-08-11T09:50:00.000Z",
    }],
    canonicalPoints: [canonical],
    nowMs: Date.parse("2026-08-11T10:00:00.000Z"),
  });

  assert.equal(plan.blocked.length, 0);
  assert.equal(plan.repairs.length, 1);
  assert.equal(plan.repairs[0].replacement.revision, 11);
  assert.deepEqual([...plan.staleEventIds], [12]);
});

test("a fresh preparing lease is not stolen by recovery", async () => {
  const { planStalePublicationRecovery } = await loadRecoveryCore();
  const plan = planStalePublicationRecovery({
    points: [{ key: "projectSnapshot.overallProgress", revision: 12 }],
    events: [{
      id: 12,
      status: "preparing",
      createdAt: "2026-08-11T09:59:00.000Z",
    }],
    canonicalPoints: [],
    nowMs: Date.parse("2026-08-11T10:00:00.000Z"),
  });

  assert.equal(plan.repairs.length, 0);
  assert.equal(plan.blocked[0].revision, 12);
});

test("file lifecycle retry is idempotent after commit and reconciles a stale crash", async () => {
  const { decideFileLifecycleRetry } = await loadLifecycleRecoveryCore();
  const marker = "2026-08-11T10:00:00.000Z";
  const nowMs = Date.parse("2026-08-11T10:10:00.000Z");

  assert.equal(decideFileLifecycleRetry({
    desiredStateApplied: false,
    stateMarker: "",
    nowMs,
  }), "apply");
  assert.equal(decideFileLifecycleRetry({
    desiredStateApplied: true,
    stateMarker: marker,
    latestPublishedAt: marker,
    nowMs,
  }), "idempotent");
  assert.equal(decideFileLifecycleRetry({
    desiredStateApplied: true,
    stateMarker: marker,
    latestPreparingAt: "2026-08-11T10:09:00.000Z",
    nowMs,
  }), "wait");
  assert.equal(decideFileLifecycleRetry({
    desiredStateApplied: true,
    stateMarker: marker,
    latestPreparingAt: "2026-08-11T10:00:00.000Z",
    nowMs,
  }), "reconcile");
});

test("central publication contract rejects invalid manual or reviewed domain values", async () => {
  const { validateLiveDataContract } = await loadContractCore();
  assert.equal(validateLiveDataContract("projectSnapshot.overallProgress", "50").valid, true);
  assert.equal(validateLiveDataContract("projectSnapshot.overallProgress", "101").valid, false);
  assert.equal(validateLiveDataContract("projectSnapshot.cutoff", '"2026-08-11"').valid, true);
  assert.equal(validateLiveDataContract("projectSnapshot.cutoff", '"11/08/2026"').valid, false);
  assert.equal(validateLiveDataContract("projectSnapshot.cutoff", '"2026-02-31"').valid, false);
  assert.equal(validateLiveDataContract("projectSnapshot.status", '"inventado"').valid, false);
  assert.equal(validateLiveDataContract("monthlyPlan.0.actual", "100").valid, true);
  assert.equal(validateLiveDataContract("monthlyPlan.0.actual", "100.01").valid, false);
  assert.equal(validateLiveDataContract("apartments.9.progress", "30").valid, false);
  assert.equal(validateLiveDataContract("apartments", JSON.stringify([
    { id: "TH-01", progress: 10, status: "en_curso" },
    { id: "TH-01", progress: 20, status: "terminado" },
  ])).valid, false);

  const [publisher, manualRoute, reviewRoute] = await Promise.all([
    readFile(new URL("../lib/publish-live-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/live-data/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/files/review/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(publisher, /assertLiveDataContracts\(input\.normalized, currentLiveData\.values\)/);
  assert.match(manualRoute, /publishLiveDataUpdates\(/);
  assert.match(reviewRoute, /publishLiveDataUpdates\(/);
});

test("controlled live append supports repeated buildings, apartments and urbanism without gaps", async () => {
  const {
    assertLiveDataContracts,
    matchesAutomaticLiveDataContract,
    validateLiveDataContract,
  } = await loadContractCore();
  const building = (number, coordinate = 20) => ({
    id: `edificio-${number}`,
    name: `Edificio ${number}`,
    shortName: String(number),
    progress: 0,
    planProgress: null,
    deviationDays: 0,
    forecastFinish: "2027-06-30",
    units: [{
      id: `${number}-101`,
      code: `${number}-101`,
      floor: 1,
      progress: 0,
      status: "en_curso",
      phase: "Superestructura",
      deviationDays: 0,
      responsible: "Obra",
      lastUpdated: "2026-08-11",
      source: "Informe",
      disciplines: [],
      issues: [],
    }],
    mapCoordinates: {
      visual: { x: coordinate, y: 30 },
      technical: { x: 40, y: 50 },
    },
  });
  const apartment = (number) => ({
    id: `1-${number}`,
    code: `1-${number}`,
    floor: 2,
    progress: 0,
    status: "en_curso",
    phase: "Superestructura",
    deviationDays: 0,
    responsible: "Obra",
    lastUpdated: "2026-08-11",
    source: "Informe",
    disciplines: [],
    issues: [],
  });
  const urbanism = (number) => ({
    id: `urban-${number}`,
    name: `Zona ${number}`,
    category: "Infraestructura",
    progress: 0,
    planned: 0,
    status: "integrado",
    source: "Informe",
    detail: "Zona incorporada",
    pendingFields: [],
    mapCoordinates: {
      visual: { x: 20, y: 30, short: `U${number}` },
      technical: { x: 40, y: 50, short: `U${number}` },
    },
  });
  const values = {};
  for (let index = 1; index <= 3; index += 1) {
    const buildingKey = `buildings.${index}`;
    const buildingValue = JSON.stringify(building(index + 1));
    assert.equal(validateLiveDataContract(buildingKey, buildingValue, values).valid, true);
    values[buildingKey] = building(index + 1);

    const apartmentKey = `buildings.0.units.${index}`;
    const apartmentValue = JSON.stringify(apartment(101 + index));
    assert.equal(validateLiveDataContract(apartmentKey, apartmentValue, values).valid, true);
    values[apartmentKey] = apartment(101 + index);

    const urbanismKey = `urbanismAreas.${index}`;
    const urbanismValue = JSON.stringify(urbanism(index));
    assert.equal(validateLiveDataContract(urbanismKey, urbanismValue, values).valid, true);
    values[urbanismKey] = urbanism(index);
  }

  assert.equal(validateLiveDataContract("buildings.4", JSON.stringify(building(2)), values).valid, false);
  assert.equal(validateLiveDataContract("buildings.2", JSON.stringify(building(99)), values).valid, false);
  assert.equal(validateLiveDataContract("buildings.5", JSON.stringify(building(6)), values).valid, false);
  assert.equal(validateLiveDataContract("buildings.4", JSON.stringify(building(5, 101)), values).valid, false);
  assert.equal(validateLiveDataContract("buildings.4", JSON.stringify({
    ...building(5),
    forecastFinish: "30/06/2027",
  }), values).valid, false);
  assert.equal(validateLiveDataContract("buildings.0.units.0.lastUpdated", '"11/08/2026"', values).valid, false);
  assert.equal(matchesAutomaticLiveDataContract(
    "buildings.4",
    JSON.stringify(building(5)),
    values,
  ), true);

  const afterDelete = { ...values };
  delete afterDelete["buildings.2"];
  assert.equal(validateLiveDataContract("buildings.4", JSON.stringify(building(5)), afterDelete).valid, false);
  assert.equal(validateLiveDataContract("buildings.2", JSON.stringify(building(3)), afterDelete).valid, false);
  // Restore is a lifecycle recomputation of the original stable key, not a new
  // publication allowed to reuse its reserved slot.
  afterDelete["buildings.2"] = building(3);
  assert.equal(validateLiveDataContract("buildings.4", JSON.stringify(building(5)), afterDelete).valid, true);

  const batchState = assertLiveDataContracts([
    { key: "buildings.1", valueJson: JSON.stringify(building(2)) },
    { key: "buildings.3", valueJson: JSON.stringify(building(4)) },
    { key: "buildings.2", valueJson: JSON.stringify(building(3)) },
  ], {});
  assert.equal(batchState["buildings.3"].id, "edificio-4");
});

test("natural spatial identities resolve to stable slots across repeated extraction and lifecycle", async () => {
  const resolveSpatialIdentityUpdates = await loadSpatialIdentityResolver();
  const values = {};
  const published = [];
  for (let sequence = 0; sequence < 3; sequence += 1) {
    const number = 80 + sequence;
    const updates = resolveSpatialIdentityUpdates([
      {
        key: `buildings.edificio${number}`,
        value: { id: `edificio-${number}`, name: `Edificio ${number}`, shortName: String(number), progress: sequence },
      },
      {
        key: `buildings.edificio${number}.units.apartamento${number}101`,
        value: { id: `${number}-101`, code: `${number}-101`, progress: sequence },
      },
      {
        key: `urbanismAreas.zona${number}`,
        value: { id: `zona-${number}`, name: `Zona ${number}`, progress: sequence },
      },
    ], values);
    for (const update of updates) {
      values[update.key] = update.value;
      published.push(update);
    }
  }

  assert.deepEqual(
    published.filter((update) => /^buildings\.\d+$/.test(update.key)).map((update) => update.key),
    ["buildings.26", "buildings.27", "buildings.28"],
  );
  assert.deepEqual(
    published.filter((update) => update.key.includes(".units.")).map((update) => update.key),
    ["buildings.26.units.0", "buildings.27.units.0", "buildings.28.units.0"],
  );
  assert.deepEqual(
    published.filter((update) => update.key.startsWith("urbanismAreas.")).map((update) => update.key),
    ["urbanismAreas.6", "urbanismAreas.7", "urbanismAreas.8"],
  );

  const sameIdentity = resolveSpatialIdentityUpdates([{
    key: "buildings.edificio81",
    value: { id: "edificio-81", progress: 55 },
  }], values)[0];
  assert.equal(sameIdentity.key, "buildings.27");
  assert.equal(sameIdentity.value.progress, 55);

  const deletedValue = values["buildings.27"];
  delete values["buildings.27"];
  const afterDelete = resolveSpatialIdentityUpdates([{
    key: "buildings.edificio83",
    value: { id: "edificio-83", name: "Edificio 83", shortName: "83" },
  }], values)[0];
  assert.equal(afterDelete.key, "buildings.29", "a deleted stable slot must never be reused");
  values[afterDelete.key] = afterDelete.value;
  values["buildings.27"] = deletedValue;
  const restoredIdentity = resolveSpatialIdentityUpdates([{
    key: "buildings.edificio81",
    value: { id: "edificio-81", progress: 60 },
  }], values)[0];
  assert.equal(restoredIdentity.key, "buildings.27");
});

test("one publication cannot contain both an ancestor and its child", async () => {
  const { publicationKeyConflict } = await loadRecoveryCore();
  assert.equal(publicationKeyConflict([
    "projectSnapshot",
    "projectSnapshot.overallProgress",
  ]).ancestor, "projectSnapshot");
  assert.equal(publicationKeyConflict([
    "projectSnapshot.overallProgress",
    "apartments.0.progress",
  ]), null);
});

test("central redactor preserves operational suppliers but removes their amounts", () => {
  const suppliers = [
    {
      id: "supplier-1",
      name: "Hormigones Caribe",
      category: "Hormigón",
      contact: "Obra",
      status: "al_dia",
      score: 92,
      nextDelivery: "2026-08-12",
      amount: "DOP 1,250,000",
    },
  ];
  const root = liveData.redactFinancialFields("projectSnapshot", {
    overallProgress: 18.23,
    suppliers,
  });
  const nested = liveData.redactFinancialFields("projectSnapshot.suppliers", suppliers);

  assert.deepEqual(JSON.parse(JSON.stringify(root)), {
    overallProgress: 18.23,
    suppliers: [{
      id: "supplier-1",
      name: "Hormigones Caribe",
      category: "Hormigón",
      contact: "Obra",
      status: "al_dia",
      score: 92,
      nextDelivery: "2026-08-12",
    }],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(nested)), JSON.parse(JSON.stringify(root.suppliers)));
  assert.equal(
    liveData.redactFinancialFields("projectSnapshot.suppliers.0.amount", "DOP 1,250,000"),
    undefined,
  );
});
