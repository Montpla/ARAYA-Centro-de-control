import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// lib/pin.ts no importa nada fuera de node:crypto, así que aquí sí se puede
// ejecutar de verdad en vez de limitarse a comprobar el texto fuente (el
// patrón que usan session.ts y login/route.ts más abajo, porque ambos tiran
// de getDb()/cloudflare:workers, que no existe fuera del runtime de Workers).
const pinSource = await readFile(new URL("../lib/pin.ts", import.meta.url), "utf8");
const pinTranspiled = ts.transpileModule(pinSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const pin = await import(`data:text/javascript;base64,${Buffer.from(pinTranspiled).toString("base64")}`);

test("dos hashes del mismo PIN nunca coinciden (sal aleatoria por intento)", () => {
  const a = pin.hashPin("1234");
  const b = pin.hashPin("1234");
  assert.notEqual(a, b);
  assert.ok(pin.verifyPin("1234", a));
  assert.ok(pin.verifyPin("1234", b));
});

test("verifyPin acepta el PIN correcto y rechaza cualquier otro", () => {
  const stored = pin.hashPin("837204");
  assert.ok(pin.verifyPin("837204", stored));
  assert.ok(!pin.verifyPin("837205", stored));
  assert.ok(!pin.verifyPin("", stored));
});

test("verifyPin no lanza con datos corruptos o de otra persona manipulados a mano", () => {
  // Son las formas en que llegaría un valor roto a verifyPin: una fila sin
  // pinHash todavía asignado, o un hash cuyo tamaño no coincide porque alguien
  // lo editó directamente en la base. Ninguna debe tirar abajo el login.
  assert.equal(pin.verifyPin("1234", ""), false);
  assert.equal(pin.verifyPin("1234", "sin-dos-puntos"), false);
  assert.equal(pin.verifyPin("1234", `${"00".repeat(16)}:abcd`), false);
});

test("validPinFormat exige solo dígitos, entre 4 y 10 posiciones", () => {
  assert.ok(pin.validPinFormat("1234"));
  assert.ok(pin.validPinFormat("1234567890"));
  assert.ok(!pin.validPinFormat("123"));
  assert.ok(!pin.validPinFormat("12345678901"));
  assert.ok(!pin.validPinFormat("12a4"));
  assert.ok(!pin.validPinFormat(""));
  assert.ok(!pin.validPinFormat(undefined));
  assert.ok(!pin.validPinFormat(1234));
});

// session.ts y el endpoint de login dependen de getDb() (cloudflare:workers),
// que no existe en node:test — igual que el resto de rutas con DB en este
// repo, se fijan por contrato sobre el código fuente.
const sessionSource = await readFile(new URL("../lib/session.ts", import.meta.url), "utf8");
const loginRoute = await readFile(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8");

test("la sesión solo guarda el hash del token, nunca el token en claro", () => {
  assert.match(sessionSource, /createHash\("sha256"\)\.update\(token\)\.digest\("hex"\)/);
  assert.match(sessionSource, /tokenHash: hashToken\(token\)/);
  assert.doesNotMatch(sessionSource, /token,\s*\n?\s*userId/);
});

test("la cookie de sesión es HttpOnly y SameSite=Lax, y lleva Secure en https", () => {
  assert.match(sessionSource, /HttpOnly; Path=\/; SameSite=Lax/);
  assert.match(sessionSource, /secure \? "; Secure" : ""/);
});

test("una sesión caducada se borra y deja de servir, no solo se ignora", () => {
  assert.match(sessionSource, /new Date\(row\.expiresAt\)\.getTime\(\) < Date\.now\(\)/);
  assert.match(sessionSource, /delete\(userSessions\)\.where\(eq\(userSessions\.tokenHash, tokenHash\)\)/);
});

test("el bloqueo por intentos fallidos es de 8 intentos y 15 minutos, y se resetea al cerrarse", () => {
  // El reseteo del contador al momento de bloquear (en vez de dejarlo en 8)
  // evita que, pasado el bloqueo, un solo intento más vuelva a bloquear de
  // inmediato antes de dar las 8 oportunidades completas de nuevo.
  assert.match(sessionSource, /const MAX_FAILED_ATTEMPTS = 8;/);
  assert.match(sessionSource, /const LOCKOUT_MS = 15 \* 60 \* 1000;/);
  assert.match(sessionSource, /attempts >= MAX_FAILED_ATTEMPTS \? 0 : attempts/);
  assert.match(sessionSource, /attempts >= MAX_FAILED_ATTEMPTS[\s\S]{0,40}new Date\(Date\.now\(\) \+ LOCKOUT_MS\)/);
});

test("clearFailedPinAttempts limpia el contador y el bloqueo juntos", () => {
  assert.match(sessionSource, /failedPinAttempts: 0, pinLockedUntil: ""/);
});

test("el login comprueba el formato de PIN antes de tocar la base de datos", () => {
  const checkIndex = loginRoute.indexOf("validPinFormat(pin)");
  const dbIndex = loginRoute.indexOf("getDb()");
  assert.ok(checkIndex > -1 && dbIndex > -1 && checkIndex < dbIndex);
});

test("el bloqueo por intentos se comprueba antes de verificar el PIN", () => {
  const lockIndex = loginRoute.indexOf("isLockedOut(existing.pinLockedUntil)");
  const verifyIndex = loginRoute.indexOf("verifyPin(pin, existing.pinHash)");
  assert.ok(lockIndex > -1 && verifyIndex > -1 && lockIndex < verifyIndex);
});

test("un PIN incorrecto cuenta como intento fallido y uno correcto limpia el contador", () => {
  assert.match(loginRoute, /if \(!existing\.pinHash \|\| !verifyPin\(pin, existing\.pinHash\)\) \{\s*\n\s*await registerFailedPinAttempt\(existing\.id, existing\.failedPinAttempts\);/);
  assert.match(loginRoute, /await clearFailedPinAttempts\(existing\.id\);/);
});

test("crear o completar el admin de arranque exige que coincidan el correo Y el PIN del entorno, comparado en tiempo constante", () => {
  assert.match(loginRoute, /Boolean\(bootstrapEmail\) && Boolean\(bootstrapPin\) && email === bootstrapEmail/);
  assert.match(loginRoute, /timingSafeStringsEqual\(pin, bootstrapPin\)/);
  // pin === bootstrapPin (fuga de tiempo) ya no se usa para esta comparación.
  assert.doesNotMatch(loginRoute, /pin === bootstrapPin/);
});

test("una cuenta borrada o que ya tiene PIN no puede (re)entrar por el camino de arranque", () => {
  // canAttemptBootstrap exige, para una cuenta ya existente, que no tenga
  // pinHash todavía Y que no esté borrada: una cuenta eliminada no puede
  // reactivarse coincidiendo con el PIN de arranque, ni una que ya tiene su
  // propio PIN puede volver a completarse con el de arranque.
  assert.match(loginRoute, /isBootstrapCandidate && \(!existing \|\| \(!existing\.pinHash && !existing\.deletedAt\)\)/);
});

test("el intento de arranque también respeta el bloqueo por intentos fallidos, antes de comparar el PIN", () => {
  const lockIndex = loginRoute.indexOf("if (existing && isLockedOut(existing.pinLockedUntil))");
  const compareIndex = loginRoute.indexOf("timingSafeStringsEqual(pin, bootstrapPin)");
  assert.ok(lockIndex > -1 && compareIndex > -1 && lockIndex < compareIndex);
});

test("un intento de arranque fallido sin cuenta todavía queda registrado, no sin límite", () => {
  assert.match(loginRoute, /createdByEmail: BOOTSTRAP_PENDING_MARKER/);
  assert.match(loginRoute, /failedPinAttempts: 1,/);
  assert.match(loginRoute, /active: false,/);
});

// lib/local-demo-mode.ts tampoco depende de getDb(), así que se ejecuta de
// verdad: NODE_ENV llega inlineado por vinext en el build de producción, con
// lo que esta comprobación queda resuelta en build time y el bypass no puede
// reactivarse por accidente con una variable mal puesta en Cloudflare.
const demoModeSource = await readFile(new URL("../lib/local-demo-mode.ts", import.meta.url), "utf8");
const demoModeTranspiled = ts.transpileModule(demoModeSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const demoMode = await import(`data:text/javascript;base64,${Buffer.from(demoModeTranspiled).toString("base64")}`);

test("LOCAL_DEMO_MODE nunca se activa en un build de producción, aunque la variable esté puesta", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDemoMode = process.env.LOCAL_DEMO_MODE;
  try {
    process.env.LOCAL_DEMO_MODE = "true";
    process.env.NODE_ENV = "production";
    assert.equal(demoMode.isLocalDemoModeEnabled(), false);
    process.env.NODE_ENV = "development";
    assert.equal(demoMode.isLocalDemoModeEnabled(), true);
    process.env.LOCAL_DEMO_MODE = "false";
    assert.equal(demoMode.isLocalDemoModeEnabled(), false);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.LOCAL_DEMO_MODE = originalDemoMode;
  }
});
