import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(String(pin), salt, KEY_LEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  if (typeof stored !== "string" || !stored.includes(":")) return false;
  const [saltHex, hashHex] = stored.split(":");
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(String(pin ?? ""), salt, KEY_LEN);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function validPinFormat(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4,10}$/.test(pin);
}
