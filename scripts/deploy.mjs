#!/usr/bin/env node
// Pipeline de despliegue en un solo comando: `npm run deploy`.
//
// Antes de este script, publicar en producción eran cinco pasos manuales
// (typecheck, build, tests, wrangler deploy, y una comprobación aparte que
// alguien tenía que acordarse de hacer a mano). Ese "alguien tiene que
// acordarse" es exactamente el patrón de bug que esta sesión pasó
// corrigiendo uno por uno en los datos vivos del dashboard — aquí se aplica
// el mismo principio al propio proceso de publicación: un solo comando que
// no se puede ejecutar a medias ni saltarse un paso sin que falle a la vista.
//
// La verificación final contra producción es la parte más importante y la
// que más se olvidaba: confirma con datos reales, no solo con que el build
// compile, que la aplicación desplegada funciona. Solo corre si existen
// DEPLOY_VERIFY_EMAIL/DEPLOY_VERIFY_PIN en el entorno local — nunca deben
// escribirse aquí ni en ningún archivo commiteado; van en variables de
// entorno o en un .dev.vars local que ya está en .gitignore.

import { execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const WRANGLER_CONFIG = "wrangler.deploy.jsonc";

function run(label, command) {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${command}`);
  try {
    execSync(command, { stdio: "inherit" });
    console.log(`✔ ${label}`);
  } catch {
    console.error(`\n✖ Falló: ${label}`);
    console.error("  El pipeline se detiene aquí. Nada de lo que sigue se ejecuta hasta que esto pase.");
    process.exit(1);
  }
}

async function smokeVerify() {
  console.log(`\n▶ Verificación contra producción (${PRODUCTION_URL})`);

  const rootResponse = await fetch(PRODUCTION_URL, { redirect: "manual" }).catch((error) => {
    console.error(`✖ No se pudo alcanzar ${PRODUCTION_URL}: ${error.message}`);
    process.exit(1);
  });
  if (rootResponse.status >= 500) {
    console.error(`✖ ${PRODUCTION_URL} respondió ${rootResponse.status} — el Worker no está sirviendo correctamente.`);
    process.exit(1);
  }
  console.log(`✔ El Worker responde (status ${rootResponse.status}).`);

  const email = process.env.DEPLOY_VERIFY_EMAIL;
  const pin = process.env.DEPLOY_VERIFY_PIN;
  if (!email || !pin) {
    console.log(
      "⚠ DEPLOY_VERIFY_EMAIL/DEPLOY_VERIFY_PIN no están en el entorno: se omite la comprobación autenticada " +
      "de datos en vivo (no es un fallo, pero es la parte que de verdad detecta regresiones de datos — " +
      "conviene definirlas en el entorno local para tener la cobertura completa).",
    );
    return;
  }

  const loginResponse = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email, pin }),
    redirect: "manual",
  });
  const setCookie = loginResponse.headers.get("set-cookie");
  const sessionMatch = setCookie?.match(/araya_session=([^;]+)/);
  if (!sessionMatch) {
    console.error("✖ El login de verificación no devolvió cookie de sesión. ¿Credenciales correctas? ¿Cuenta activa?");
    process.exit(1);
  }
  console.log("✔ Login de verificación correcto.");

  const controlRoomResponse = await fetch(`${PRODUCTION_URL}/api/control-room`, {
    headers: { Cookie: `araya_session=${sessionMatch[1]}` },
  });
  if (!controlRoomResponse.ok) {
    console.error(`✖ /api/control-room devolvió ${controlRoomResponse.status}.`);
    process.exit(1);
  }
  const controlRoom = await controlRoomResponse.json();

  // Guarda de regresión concreta: el bug real de esta sesión (avance físico
  // y plan operativo comparando meses distintos). Si esto alguna vez vuelve
  // a divergir, es la señal más clara de que algo del ciclo de sincronización
  // en vivo se rompió.
  const { kpiPlan, curvePlanAtCutoff } = controlRoom.planning ?? {};
  if (typeof kpiPlan !== "number" || typeof curvePlanAtCutoff !== "number") {
    console.error("✖ /api/control-room no devolvió planning.kpiPlan/curvePlanAtCutoff como números.");
    process.exit(1);
  }
  if (Math.abs(kpiPlan - curvePlanAtCutoff) > 0.01) {
    console.error(
      `✖ planning.kpiPlan (${kpiPlan}) y planning.curvePlanAtCutoff (${curvePlanAtCutoff}) no coinciden — ` +
      "el plan operativo y la Curva S están comparando meses distintos otra vez.",
    );
    process.exit(1);
  }
  console.log(`✔ Plan operativo y Curva S coinciden (${kpiPlan}%, mismo corte).`);

  if (!controlRoom.documents || typeof controlRoom.documents.total !== "number") {
    console.error("✖ /api/control-room no devolvió un resumen de documentos válido.");
    process.exit(1);
  }
  console.log(`✔ Centro de datos responde (${controlRoom.documents.total} expedientes con seguimiento activo).`);

  // Guarda de regresión concreta: app/data-center/[...path]/route.ts sirve
  // estos archivos solo desde R2 (nunca desde dist/client), y esa subida a
  // R2 vive fuera del build normal (scripts/sync-historical-documents.mjs).
  // Si esa sincronización falla o el objeto se borra en R2, esta es la única
  // comprobación que lo nota con una sesión real autenticada.
  const guideUrl = `${PRODUCTION_URL}/data-center/guias/guia-corporativa-bricket-control-personal-obra.pdf`;
  const guideResponse = await fetch(guideUrl, {
    headers: { Cookie: `araya_session=${sessionMatch[1]}` },
  });
  if (!guideResponse.ok) {
    const guideBody = await guideResponse.text().catch(() => "");
    console.error(`✖ ${guideUrl} devolvió ${guideResponse.status} con sesión autenticada — la guía no está en R2.`);
    if (guideBody) console.error(`  Cuerpo de la respuesta: ${guideBody}`);
    process.exit(1);
  }
  const guideContentType = guideResponse.headers.get("content-type") ?? "";
  if (!guideContentType.includes("pdf")) {
    console.error(`✖ ${guideUrl} respondió ${guideResponse.status} pero con Content-Type "${guideContentType}" (se esperaba PDF).`);
    process.exit(1);
  }
  console.log(`✔ Guía corporativa accesible con sesión autenticada (${guideResponse.status}, ${guideContentType}).`);
}

console.log("=== Pipeline de despliegue: Centro de Control ARAYA ===");

run("Typecheck", "npx tsc --noEmit -p .");
run("Build", "npm run build");
run("Pruebas", "node --test tests/*.mjs");
run("Despliegue a Cloudflare Workers", `npx wrangler deploy --config ${WRANGLER_CONFIG}`);
run("Sincronizar documentos corporativos con R2", "node scripts/sync-historical-documents.mjs");

console.log("\nEsperando unos segundos a que el despliegue esté completamente disponible…");
await sleep(4000);

await smokeVerify();

console.log("\n=== Publicado y verificado ===");
