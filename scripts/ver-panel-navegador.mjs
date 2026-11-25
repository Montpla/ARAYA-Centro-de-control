#!/usr/bin/env node
// Sólo lectura: abre el panel de producción en un navegador real, como lo ve
// la oficina, y cuenta qué pinta. Sirve cuando un dato está bien publicado en
// /api/live-data pero el panel enseña otra cosa (p. ej. edificios con el valor
// base en vez del de la cubicación). Imprime errores de la página, el estado
// de sincronización y los porcentajes de la vista de edificios. Sin importes.

import { chromium } from "playwright-core";

const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("✖ Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN en el entorno.");
  process.exit(1);
}
const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/);
if (!session) {
  console.error("✖ El login no devolvió cookie de sesión.");
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--headless=new", "--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addCookies([{ name: "araya_session", value: session[1], url: PRODUCTION_URL }]);
const page = await context.newPage();
const errores = [];
page.on("pageerror", (error) => errores.push(`pageerror: ${String(error.message).slice(0, 400)}`));
page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") errores.push(`${message.type()}: ${message.text().slice(0, 400)}`);
});

await page.goto(`${PRODUCTION_URL}/?view=edificios`, { waitUntil: "load", timeout: 60_000 });
await page.waitForTimeout(12_000);

const sincronizacion = await page.locator("text=/sincroniza|sin conexión|offline|no disponible/i").first().textContent().catch(() => "(no encontrado)");
console.log(`Estado mostrado: ${String(sincronizacion).trim().slice(0, 200)}`);
const pestañas = await page.locator(".building-tabs button").evaluateAll((botones) =>
  botones.map((boton) => boton.textContent.replace(/\s+/g, " ").trim()));
console.log(`\n=== Vista de edificios (${pestañas.length}) ===`);
console.log(pestañas.join(" · "));

const vivos = await page.evaluate(async () => {
  const respuesta = await fetch("/api/live-data", { cache: "no-store" });
  const datos = await respuesta.json();
  return Object.entries(datos.values ?? {})
    .filter(([clave]) => /^buildings\.\d+\.progress$/.test(clave))
    .map(([clave, valor]) => `${clave}=${valor}`);
});
console.log(`\n=== /api/live-data desde la misma página (${vivos.length}) ===`);
console.log(vivos.join(" · "));

console.log(`\n=== Errores y avisos de la página (${errores.length}) ===`);
for (const error of [...new Set(errores)].slice(0, 40)) console.log(error);
await browser.close();
