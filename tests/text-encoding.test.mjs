import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const invalidEncoding = /Ã|Â|â€™|â€œ|â€|�/;

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(url)));
    } else if (/\.(?:css|ts|tsx)$/.test(entry.name)) {
      files.push(url);
    }
  }

  return files;
}

test("la interfaz y sus mensajes no contienen texto con codificación rota", async () => {
  const files = [
    ...(await sourceFiles(new URL("app/", root))),
    ...(await sourceFiles(new URL("lib/", root))),
  ];
  const broken = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    if (invalidEncoding.test(content)) broken.push(file.pathname);
  }

  assert.deepEqual(broken, [], `Archivos con mojibake:\n${broken.join("\n")}`);
});
