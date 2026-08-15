import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Los tokens de carga automática son la única credencial del sistema que vive
// fuera del navegador —en el equipo de la oficina, dentro de una macro—, así
// que sus garantías se fijan por escrito: son las que limitan el daño si el
// archivo con el token acaba donde no debe.

const fuente = await readFile(new URL("../lib/upload-agent-auth.ts", import.meta.url), "utf8");
const rutaCarga = await readFile(new URL("../app/api/files/route.ts", import.meta.url), "utf8");
const rutaAdmin = await readFile(new URL("../app/api/admin/upload-tokens/route.ts", import.meta.url), "utf8");
const migracion = await readFile(new URL("../drizzle/0022_upload_agent_tokens.sql", import.meta.url), "utf8");
const cliente = await readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8");

test("el token nunca se guarda en claro", () => {
  // Igual que las sesiones y los tokens de TV: en la base sólo vive el hash,
  // así que ni un volcado completo revela una credencial utilizable.
  assert.match(fuente, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(migracion, /token_hash/);
  assert.doesNotMatch(migracion, /`token`\s+text/);
});

test("se rechaza un token revocado o caducado antes de mirar nada más", () => {
  assert.match(fuente, /if \(row\.revokedAt\) return null;/);
  assert.match(fuente, /expiresAt[\s\S]{0,80}getTime\(\) <= Date\.now\(\)[\s\S]{0,20}return null/);
});

test("un token de alguien desactivado o borrado deja de servir", () => {
  // El borrado de usuarios es lógico: sin comprobar deletedAt, el token de una
  // persona eliminada seguiría escribiendo en el modelo vivo.
  assert.match(fuente, /eq\(appUsers\.active, true\)/);
  assert.match(fuente, /eq\(appUsers\.deletedAt, ""\)/);
});

test("el token hereda los permisos de su responsable, no los suyos", () => {
  // publicUser aplica la regla de que un administrador tiene acceso financiero
  // aunque su casilla diga lo contrario. Reusarla evita que existan dos
  // criterios distintos sobre quién puede publicar cifras.
  assert.match(fuente, /publicUser\(user\)/);
  assert.doesNotMatch(fuente, /financeAccess:\s*true/);
});

test("cada uso deja rastro", () => {
  assert.match(fuente, /lastUsedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(fuente, /useCount/);
});

test("la carga con token recorre exactamente el mismo camino que una manual", () => {
  // El token se resuelve a una persona y a partir de ahí no hay ninguna rama
  // aparte: misma clasificación, mismo contrato, misma publicación y misma
  // auditoría. Una carga automática no puede hacer nada que su responsable no
  // pudiera hacer a mano.
  assert.match(rutaCarga, /const agentToken = readUploadAgentToken\(request\)/);
  assert.match(rutaCarga, /resolveUploadAgentToken\(agentToken\)/);
  assert.match(rutaCarga, /status: 401/);
  // Un único punto donde se decide el usuario, sin duplicar el resto del flujo.
  assert.equal((rutaCarga.match(/const candidate = formData\.get\("file"\)/g) ?? []).length, 1);
});

test("sólo un administrador emite o revoca cargas automáticas", () => {
  const exigencias = rutaAdmin.match(/requireApiUser\(\{ admin: true \}\)/g) ?? [];
  assert.equal(exigencias.length, 3, "GET, POST y PATCH deben exigir administrador");
});

test("no se emite un token a nombre de alguien que no puede usarlo", () => {
  assert.match(rutaAdmin, /eq\(appUsers\.active, true\)/);
  assert.match(rutaAdmin, /no existe o no está activa/);
});

test("el token en claro sólo viaja en la respuesta de creación", () => {
  // Aparece una vez, al crearlo. Ni el listado ni la revocación lo devuelven.
  assert.match(rutaAdmin, /secret: token/);
  // Se acota al cuerpo de publicToken: buscar "secret" desde su declaración
  // hasta el final del archivo encontraba el de la creación y daba un falso
  // positivo. Lo que importa es que la forma pública del token no lo lleve.
  const cuerpoPublico = rutaAdmin.slice(
    rutaAdmin.indexOf("function publicToken"),
    rutaAdmin.indexOf("const AVISO_MIGRACION"),
  );
  assert.ok(cuerpoPublico.length > 0, "publicToken debe existir");
  assert.doesNotMatch(cuerpoPublico, /secret|tokenHash/);
});

test("las cargas automáticas se administran desde el panel, no llamando a la API", () => {
  // Quien administra el Centro de Control no suele estar en la oficina donde se
  // suben los archivos. Sin panel habría que llamar a la API a mano para dar de
  // alta cada equipo, que es justo lo que impedía repartir accesos en remoto.
  assert.match(cliente, /function UploadAgentsCard/);
  assert.match(cliente, /<UploadAgentsCard users=\{configuredUsers\} \/>/);
  assert.match(cliente, /\/api\/admin\/upload-tokens/);
  assert.match(cliente, /method: "PATCH"[\s\S]{0,200}upload-tokens|upload-tokens[\s\S]{0,200}method: "PATCH"/);
});

test("el panel avisa de lo que implica compartir un token", () => {
  // Un token por equipo permite revocar sólo el ordenador afectado si se
  // pierde; uno compartido por todos obliga a reconfigurarlos todos.
  assert.match(cliente, /un token por\s*\n?\s*equipo y no uno compartido/);
  assert.match(cliente, /heredan sus permisos/);
  assert.match(cliente, /no vuelve a\s*\n?\s*mostrarse/);
});
