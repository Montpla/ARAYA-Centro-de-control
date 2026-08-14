#!/usr/bin/env node
// Sube a R2 todos los documentos fijos bajo historical/data-center/.
//
// `app/data-center/[...path]/route.ts` es la única ruta que los sirve, y
// wrangler.deploy.jsonc la marca `run_worker_first: ["/data-center/*"]`: esas
// peticiones nunca las resuelve la capa de activos estáticos (`dist/client`),
// siempre pasan por el Worker, que busca el objeto en el bucket R2 `FILES`
// bajo la clave `historical${pathname}`. El directorio del repo replica esa
// clave: historical/data-center/<ruta> ↔ clave R2 historical/data-center/<ruta>
// ↔ URL /data-center/<ruta>.
//
// Estos documentos NO deben vivir bajo public/: vinext registra todo public/
// como rutas de archivo estático que ganan a las rutas dinámicas de la app
// (orden de Next.js), así que un archivo en public/data-center/... eclipsa a
// route.ts y la petición acaba en env.ASSETS.fetch(), que devuelve 404 vacío
// porque public/.assetsignore excluye data-center/** de los activos. Ese era
// el 404 de producción de todos los documentos fijos del Centro de Control.
//
// Para que la subida a R2 no pueda volver a olvidarse, este script recorre
// todo historical/data-center/ y sincroniza cada archivo con su clave R2
// correspondiente en cada `npm run deploy` — no depende de una lista a
// mano que alguien tenga que recordar actualizar.

import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WRANGLER_CONFIG = "wrangler.deploy.jsonc";
const SOURCE_DIR = path.join(ROOT, "historical", "data-center");

const config = JSON.parse(readFileSync(path.join(ROOT, WRANGLER_CONFIG), "utf8"));
const bucketName = config.r2_buckets?.find((bucket) => bucket.binding === "FILES")?.bucket_name;
if (!bucketName) {
  console.error(`✖ No se encontró el bucket con binding "FILES" en ${WRANGLER_CONFIG}.`);
  process.exit(1);
}

// Debe reflejar canonicalMimeByExtension en app/data-center/[...path]/route.ts.
const contentTypeByExtension = {
  csv: "text/csv; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  dwg: "image/vnd.dwg",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json; charset=utf-8",
  mpp: "application/vnd.ms-project",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

function collectFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

if (!statSync(SOURCE_DIR, { throwIfNoEntry: false })?.isDirectory()) {
  console.log(`  (no existe ${SOURCE_DIR}, nada que sincronizar)`);
  process.exit(0);
}

const files = collectFiles(SOURCE_DIR);
console.log(`  ${files.length} documento(s) bajo historical/data-center/`);

for (const filePath of files) {
  const relativePath = path.relative(SOURCE_DIR, filePath).split(path.sep).join("/");
  const key = `historical/data-center/${relativePath}`;
  const extension = relativePath.split(".").at(-1)?.toLowerCase() ?? "";
  const contentType = contentTypeByExtension[extension] || "application/octet-stream";
  const command = [
    "npx wrangler r2 object put",
    `"${bucketName}/${key}"`,
    `--file "${filePath}"`,
    `--content-type "${contentType}"`,
    "--remote",
    `--config ${WRANGLER_CONFIG}`,
  ].join(" ");
  console.log(`  $ wrangler r2 object put ${bucketName}/${key}`);
  execSync(command, { cwd: ROOT, stdio: "inherit" });
}
