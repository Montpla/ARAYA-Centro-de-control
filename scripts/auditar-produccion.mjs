#!/usr/bin/env node

const PRODUCTION_URL = process.env.PRODUCTION_URL || "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
if (!email || !pin) {
  console.error("Faltan DEPLOY_VERIFY_EMAIL / DEPLOY_VERIFY_PIN.");
  process.exit(1);
}

const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) {
  console.error(`El login de auditoría falló (${login.status}).`);
  process.exit(1);
}
const headers = { Cookie: `araya_session=${session}`, "Content-Type": "application/json" };
const date = new Date().toISOString().slice(0, 10);

async function action(payload) {
  const response = await fetch(`${PRODUCTION_URL}/api/automation-center`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Automatización ${response.status}.`);
  return result;
}

const audit = await action({ action: "run_audit", idempotencyKey: `nightly-audit:${date}` });
console.log(audit.result?.run?.summary || "Auditoría completada.");
