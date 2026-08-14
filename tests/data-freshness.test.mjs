import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AGING_MAX_DAYS,
  FRESH_MAX_DAYS,
  STAT_CARD_FRESHNESS_KEYS,
  readFreshness,
} from "../lib/data-freshness.ts";

// Ancla fija: el semáforo se prueba contra un "ahora" explícito para que el
// resultado no dependa del día en que se ejecuten las pruebas.
const NOW = Date.parse("2026-08-14T12:00:00Z");
const daysAgo = (days) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

test("freshness grades a KPI by the age of its cutoff, not by polling speed", () => {
  const fresh = readFreshness(
    { monthlyPlan: { cutoff: daysAgo(10), sourceName: "Excel maestro" } },
    ["monthlyPlan"],
    NOW,
  );
  assert.equal(fresh.level, "fresh");
  assert.equal(fresh.ageDays, 10);
  assert.equal(fresh.basis, "cutoff");
  assert.equal(fresh.sourceName, "Excel maestro");

  assert.equal(readFreshness({ monthlyPlan: { cutoff: daysAgo(FRESH_MAX_DAYS) } }, ["monthlyPlan"], NOW).level, "fresh");
  assert.equal(readFreshness({ monthlyPlan: { cutoff: daysAgo(FRESH_MAX_DAYS + 1) } }, ["monthlyPlan"], NOW).level, "aging");
  assert.equal(readFreshness({ monthlyPlan: { cutoff: daysAgo(AGING_MAX_DAYS) } }, ["monthlyPlan"], NOW).level, "aging");
  assert.equal(readFreshness({ monthlyPlan: { cutoff: daysAgo(AGING_MAX_DAYS + 1) } }, ["monthlyPlan"], NOW).level, "stale");
});

test("freshness prefers the data cutoff over the publication date", () => {
  // Un archivo de junio subido en agosto sigue siendo un dato de junio: lo
  // que envejece es la evidencia, no el momento en que alguien la cargó.
  const reading = readFreshness(
    { monthlyPlan: { cutoff: daysAgo(90), updatedAt: daysAgo(1) } },
    ["monthlyPlan"],
    NOW,
  );
  assert.equal(reading.level, "stale");
  assert.equal(reading.basis, "cutoff");

  // Sin corte declarado se usa la publicación, y queda señalado como tal.
  const fallback = readFreshness({ monthlyPlan: { updatedAt: daysAgo(2) } }, ["monthlyPlan"], NOW);
  assert.equal(fallback.basis, "updatedAt");
  assert.equal(fallback.level, "fresh");
  assert.match(fallback.label, /sin corte declarado/);
});

test("freshness accepts Spanish cutoffs and subkeys, and takes the newest evidence", () => {
  // dd/mm/aaaa es el formato de varios cortes declarados del proyecto.
  const spanish = readFreshness({ projectSnapshot: { cutoff: "30/06/2026" } }, ["projectSnapshot"], NOW);
  assert.equal(spanish.basis, "cutoff");
  assert.equal(spanish.ageDays, 45);
  assert.equal(spanish.level, "aging");

  // Una raíz cubre sus subclaves, y entre varias gana la más reciente.
  const nested = readFreshness(
    {
      "monthlyPlan.12.actual": { cutoff: daysAgo(60) },
      "monthlyPlan.13.actual": { cutoff: daysAgo(5) },
      "otraRaiz.x": { cutoff: daysAgo(1) },
    },
    ["monthlyPlan"],
    NOW,
  );
  assert.equal(nested.ageDays, 5);
  assert.equal(nested.level, "fresh");
});

test("freshness stays silent instead of guessing when provenance is missing", () => {
  // Preferimos no mostrar semáforo antes que atribuir a un KPI una
  // procedencia que no es la suya: el valor de respaldo documental es
  // legítimo, simplemente no tiene fecha viva que mostrar.
  const missing = readFreshness({}, ["monthlyPlan"], NOW);
  assert.equal(missing.level, "unknown");
  assert.equal(missing.ageDays, null);

  const unrelated = readFreshness({ buildings: { cutoff: daysAgo(1) } }, ["monthlyPlan"], NOW);
  assert.equal(unrelated.level, "unknown");

  // Una fecha ilegible no debe degradarse a "hoy" ni reventar.
  const broken = readFreshness({ monthlyPlan: { cutoff: "sin fecha" } }, ["monthlyPlan"], NOW);
  assert.equal(broken.level, "unknown");
});

test("every KPI wired to the freshness dot maps to real live-data roots", async () => {
  const liveData = await readFile("lib/live-data.ts", "utf8");
  const rootsBlock = liveData.match(/export const LIVE_DATA_ROOTS = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
  const roots = new Set([...rootsBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1]));
  assert.ok(roots.size > 10, "no se pudieron leer las raíces vivas");

  for (const [eyebrow, keys] of Object.entries(STAT_CARD_FRESHNESS_KEYS)) {
    assert.ok(keys.length > 0, `${eyebrow} no declara ninguna clave`);
    for (const key of keys) {
      assert.ok(
        roots.has(key),
        `${eyebrow} apunta a "${key}", que no es una raíz de LIVE_DATA_ROOTS (el semáforo nunca se encendería)`,
      );
    }
  }

  // Y el cliente debe seguir alimentando el contexto con la procedencia real
  // del API, no con un objeto vacío que dejaría el semáforo siempre apagado.
  const dashboard = await readFile("app/dashboard-client.tsx", "utf8");
  assert.match(dashboard, /setLiveProvenance\(liveData\.provenance \?\? \{\}\)/);
  assert.match(dashboard, /<ProvenanceContext\.Provider value=\{liveProvenance\}>/);
});
