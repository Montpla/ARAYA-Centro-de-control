// Genera el par de claves VAPID que el Centro de Control necesita para mandar
// avisos al móvil (los "globos" nativos del teléfono).
//
// VAPID no es darse de alta en ningún servicio: es un par de claves —una
// pública y una privada— que identifican a esta aplicación ante el servicio de
// notificaciones del navegador. Se generan una vez, aquí mismo, sin cuenta ni
// nada externo, y se pegan como variables del Worker en Cloudflare:
//
//   VAPID_PUBLIC_KEY   — la clave pública (la ve el navegador al suscribirse).
//   VAPID_PRIVATE_KEY  — la clave privada (sólo la conoce el servidor; secreta).
//   VAPID_SUBJECT      — un contacto, en formato "mailto:tu-correo@dominio".
//
// Uso:
//   node scripts/generate-vapid-keys.mjs [correo-de-contacto]
//
// Después, en Cloudflare → el Worker araya-centro-control → Settings →
// Variables, se añaden las tres. En cuanto estén, los avisos empiezan a llegar
// al móvil solos. Para cambiarlas en el futuro, se vuelve a ejecutar esto y se
// sustituyen las tres (los dispositivos se re-suscriben solos).

import { webcrypto } from "node:crypto";

const base64url = (bytes) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const pair = await webcrypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

// Pública: el punto sin comprimir de 65 bytes (empieza por 0x04), en base64url.
const rawPublic = new Uint8Array(await webcrypto.subtle.exportKey("raw", pair.publicKey));

// Privada: el escalar `d` de 32 bytes. Se extrae del JWK, que lo expone en
// base64url ya con el formato que espera el estándar de web push.
const jwk = await webcrypto.subtle.exportKey("jwk", pair.privateKey);

const contacto = process.argv[2]?.trim();
const subject = contacto
  ? (contacto.startsWith("mailto:") || contacto.startsWith("http") ? contacto : `mailto:${contacto}`)
  : "mailto:avisos@grupobricket.com";

console.log("\nCopia estas tres variables en Cloudflare (Worker → Settings → Variables):\n");
console.log(`VAPID_PUBLIC_KEY   = ${base64url(rawPublic)}`);
console.log(`VAPID_PRIVATE_KEY  = ${jwk.d}`);
console.log(`VAPID_SUBJECT      = ${subject}`);
console.log("\nLa privada es secreta: no la compartas ni la subas a ningún sitio.\n");
