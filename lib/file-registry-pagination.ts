export const DEFAULT_FILE_PAGE_SIZE = 75;
export const MAX_FILE_PAGE_SIZE = 200;

export type FileRegistryCursor = {
  timestamp: string;
  id: string;
};

export type FileRegistryRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

function isCursorTimestamp(value: unknown): value is string {
  return typeof value === "string" &&
    value.length >= 10 &&
    value.length <= 40 &&
    !Number.isNaN(Date.parse(value));
}

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeFileRegistryCursor(cursor: FileRegistryCursor) {
  return toBase64Url(JSON.stringify([cursor.timestamp, cursor.id]));
}

export function decodeFileRegistryCursor(value: string | null | undefined) {
  if (!value || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(value)) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [timestamp, id] = parsed;
    if (!isCursorTimestamp(timestamp) || typeof id !== "string" || id.length > 160) return null;
    return { timestamp, id } satisfies FileRegistryCursor;
  } catch {
    return null;
  }
}

export function normalizeFilePageSize(value: string | null | undefined) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_FILE_PAGE_SIZE;
  return Math.min(parsed, MAX_FILE_PAGE_SIZE);
}

export function latestFileRegistryCursor(
  left: FileRegistryCursor,
  right: FileRegistryCursor,
) {
  if (left.timestamp !== right.timestamp) {
    return left.timestamp > right.timestamp ? left : right;
  }
  return left.id >= right.id ? left : right;
}

function compareRegistryRecords<RegistryRecord extends FileRegistryRecord>(
  left: RegistryRecord,
  right: RegistryRecord,
) {
  const created = right.createdAt.localeCompare(left.createdAt);
  return created || right.id.localeCompare(left.id);
}

/**
 * Reconciles recent/change pages without discarding historical pages already
 * opened by the user. A stale response cannot overwrite a newer record.
 */
export function mergeFileRegistryRecords<RegistryRecord extends FileRegistryRecord>(
  current: RegistryRecord[],
  incoming: RegistryRecord[],
  removedIds: string[] = [],
) {
  const removed = new Set(removedIds);
  const records = new Map(
    current
      .filter((record) => !removed.has(record.id))
      .map((record) => [record.id, record]),
  );
  incoming.forEach((record) => {
    const existing = records.get(record.id);
    if (!existing || record.updatedAt >= existing.updatedAt) records.set(record.id, record);
  });
  return [...records.values()].sort(compareRegistryRecords);
}
