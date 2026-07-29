export type CurrencyCode = "USD" | "DOP";

export const DEFAULT_DISPLAY_CURRENCY: CurrencyCode = "USD";
export const DOP_TO_USD = 0.016788;
export const USD_TO_DOP = 1 / DOP_TO_USD;
export const FX_RATE_CUTOFF = "30/06/2026";

const decimal = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function convertCurrency(
  value: number,
  sourceCurrency: CurrencyCode,
  displayCurrency: CurrencyCode,
) {
  if (sourceCurrency === displayCurrency) return value;
  return sourceCurrency === "DOP" ? value * DOP_TO_USD : value * USD_TO_DOP;
}

export function formatMoney(
  value: number,
  sourceCurrency: CurrencyCode,
  displayCurrency: CurrencyCode = DEFAULT_DISPLAY_CURRENCY,
) {
  const converted = convertCurrency(value, sourceCurrency, displayCurrency);
  const prefix = displayCurrency === "USD" ? "USD " : "RD$";
  return `${converted < 0 ? "–" : ""}${prefix}${decimal.format(Math.abs(converted))}`;
}

export function formatMoneyMillions(
  value: number,
  sourceCurrency: CurrencyCode,
  displayCurrency: CurrencyCode = DEFAULT_DISPLAY_CURRENCY,
) {
  const converted = convertCurrency(value, sourceCurrency, displayCurrency);
  const prefix = displayCurrency === "USD" ? "USD " : "RD$";
  return `${converted < 0 ? "–" : ""}${prefix}${decimal.format(Math.abs(converted) / 1_000_000)} M`;
}

export function resolveSourceCurrency(input: {
  declaredCurrency?: string;
  fileName?: string;
  description?: string;
}): CurrencyCode {
  const declared = input.declaredCurrency?.trim().toUpperCase();
  if (declared === "USD") return "USD";
  if (declared === "DOP") return "DOP";

  const text = `${input.fileName ?? ""} ${input.description ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/\b(usd|us\$|dolar|dolares|dollar|dollars)\b/.test(text)) return "USD";
  return "DOP";
}

export function exchangeRateNote(displayCurrency: CurrencyCode) {
  return displayCurrency === "USD"
    ? `Conversión visual · 1 DOP = ${DOP_TO_USD.toFixed(6)} USD · corte ${FX_RATE_CUTOFF}`
    : `Importes fuente en DOP · 1 USD = ${USD_TO_DOP.toFixed(6)} DOP · corte ${FX_RATE_CUTOFF}`;
}
