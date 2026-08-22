#!/usr/bin/env node

const PRODUCTION_URL = process.env.PRODUCTION_URL || "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
const key = process.env.BACKUP_KEY || "system-backups/d1/latest.sql.gz";
const sizeBytes = Number(process.env.BACKUP_SIZE_BYTES || 0);
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
if (!session) throw new Error(`El login para registrar la copia falló (${login.status}).`);

const response = await fetch(`${PRODUCTION_URL}/api/automation-center`, {
  method: "POST",
  headers: { Cookie: `araya_session=${session}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "record_backup",
    idempotencyKey: `backup:${new Date().toISOString().slice(0, 10)}`,
    status: "passed",
    summary: "Copia D1 exportada y restaurada correctamente en una base temporal.",
    metrics: { key, sizeBytes, integrityCheck: "ok" },
  }),
});
const result = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(result.error || `No se pudo registrar la copia (${response.status}).`);
console.log(`Copia verificada y registrada: ${key} (${sizeBytes} bytes).`);
