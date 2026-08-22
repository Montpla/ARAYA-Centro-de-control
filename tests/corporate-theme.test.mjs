import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const theme = await readFile(new URL("app/corporate-theme.css", root), "utf8");
const legacy = await readFile(new URL("app/globals.css", root), "utf8");
const layout = await readFile(new URL("app/layout.tsx", root), "utf8");

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const normalized = hex.replace("#", "");
  const [red, green, blue] = [0, 2, 4].map((offset) =>
    channel(Number.parseInt(normalized.slice(offset, offset + 2), 16)),
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function token(name) {
  const match = theme.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, `Falta el token corporativo --${name}`);
  return match[1];
}

test("la capa corporativa se carga después de los estilos históricos", () => {
  const legacyIndex = layout.indexOf('import "./globals.css"');
  const themeIndex = layout.indexOf('import "./corporate-theme.css"');

  assert.ok(legacyIndex >= 0, "Debe mantenerse la hoja funcional existente");
  assert.ok(themeIndex > legacyIndex, "El tema corporativo debe tener prioridad final");
});

test("los colores de texto corporativos cumplen contraste AA", () => {
  const surface = token("surface");
  const paper = token("paper");
  const navigation = token("navy-2");

  assert.ok(contrast(token("ink"), surface) >= 7, "El texto principal debe superar AAA");
  assert.ok(contrast(token("muted"), surface) >= 4.5, "El texto secundario debe superar AA");
  assert.ok(contrast(token("orange"), surface) >= 4.5, "El acento usado como texto debe superar AA");
  assert.ok(contrast(token("ink"), paper) >= 7, "El texto sobre el lienzo debe superar AAA");
  assert.ok(contrast("#c5c5bd", navigation) >= 4.5, "La navegación lateral debe superar AA");
});

test("el encabezado oscuro del control operativo mantiene todas sus lecturas en blanco", () => {
  assert.match(
    theme,
    /\.control-room-heading h2,[\s\S]*?\.control-room-heading p,[\s\S]*?\.control-room-heading \.control-room-live strong,[\s\S]*?\.control-room-heading \.control-room-live small\s*\{[\s\S]*?color:\s*#ffffff;/,
  );
  assert.ok(
    contrast("#ffffff", "#1f2927") >= 7,
    "El texto blanco sobre el carbón del encabezado debe superar AAA",
  );
});

test("la escala mínima de lectura y los objetivos táctiles quedan fijados", () => {
  assert.match(theme, /html,\s*\nbody\s*\{[\s\S]*?font-size:\s*15px;/);
  assert.match(theme, /@media \(max-width:\s*1100px\)[\s\S]*?font-size:\s*16px;/);
  assert.match(theme, /\.data-note,[\s\S]*?font-size:\s*13px;/);
  assert.match(theme, /\.button\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(theme, /\.mobile-bottom-nav button\s*\{[\s\S]*?min-height:\s*58px;/);
  assert.match(theme, /:focus-visible[\s\S]*?outline:\s*3px solid/);
});

test("el sistema cubre escritorio, tablet, móvil, tablas, visor y plano", () => {
  for (const expected of [
    "@media (max-width: 1100px)",
    "@media (max-width: 760px)",
    "@media (max-width: 420px)",
    ".safety-weekly-table th",
    ".file-viewer-toolbar",
    ".plan-building-trigger",
    ".line-chart-month",
    ".control-room-table",
    ".agent-input textarea",
  ]) {
    assert.ok(theme.includes(expected), `Falta cobertura visual para ${expected}`);
  }
});

test("la identidad evita fuentes genéricas de dashboard y efectos decorativos", () => {
  assert.doesNotMatch(theme, /\b(?:Inter|Roboto|Open Sans)\b/i);
  assert.doesNotMatch(theme, /(?:linear|radial|conic)-gradient/i);
  assert.match(theme, /--font-editorial:[^;]*(?:Iowan Old Style|Baskerville|Georgia)/);
  assert.match(theme, /--font-ui:[^;]*(?:Aptos|Segoe UI Variable)/);
});

test("ninguna regla histórica de 10 px o menos queda sin cobertura corporativa", () => {
  const uncovered = [];

  for (const match of legacy.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const size = match[2].match(/font-size:\s*([0-9.]+)px/);
    if (!size || Number(size[1]) > 10) continue;

    const selector = match[1]
      .trim()
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trim();
    if (!selector.includes(".") || selector.startsWith("@")) continue;

    const firstSelector = selector.split(",")[0].trim();
    if (!theme.includes(firstSelector)) uncovered.push(`${size[1]}px ${selector}`);
  }

  assert.deepEqual(uncovered, [], `Reglas sin corregir:\n${uncovered.join("\n")}`);
});
