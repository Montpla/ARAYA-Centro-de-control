#!/usr/bin/env node
const PRODUCTION_URL = "https://araya-centro-control.grupobricket.workers.dev";
const email = process.env.DEPLOY_VERIFY_EMAIL;
const pin = process.env.DEPLOY_VERIFY_PIN;
const fileId = process.env.FILE_ID;

const login = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ email, pin }),
  redirect: "manual",
});
const session = login.headers.get("set-cookie")?.match(/araya_session=([^;]+)/)?.[1];
if (!session) { console.error(`Login falló (${login.status})`); process.exit(1); }
const Cookie = `araya_session=${session}`;

const data = await fetch(`${PRODUCTION_URL}/api/files/review?file=${fileId}`, { headers: { Cookie } }).then((r) => r.json());
console.log("=== actividad del expediente ===");
for (const a of data.activity ?? []) {
  console.log(`[${a.createdAt}] ${a.eventType}: ${a.message}`);
}
