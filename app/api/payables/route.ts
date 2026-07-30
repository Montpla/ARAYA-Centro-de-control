import { eq, like, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { liveDataPoints } from "../../../db/schema";
import { requireApiUser } from "../../../lib/access-control";
import { LiveDataMap, materializeLiveRoot } from "../../../lib/live-data";
import {
  antonelyPayableInvoiceLines,
  buildPayablesDataset,
  normalizePayableInvoiceLines,
} from "../../antonely-payable-invoices";

export const runtime = "edge";

export async function GET() {
  const auth = await requireApiUser({ finance: true });
  if (!auth.user) return auth.response;

  let lines = antonelyPayableInvoiceLines;
  let metadata: {
    cutoff?: string;
    sourceName?: string;
    updatedAt?: string;
  } = {};

  try {
    const db = getDb();
    const liveRows = await db
      .select()
      .from(liveDataPoints)
      .where(or(
        eq(liveDataPoints.key, "antonelyPayableInvoiceLines"),
        like(liveDataPoints.key, "antonelyPayableInvoiceLines.%"),
      ));
    if (liveRows.length) {
      const values: LiveDataMap = {};
      liveRows.forEach((row) => {
        try {
          values[row.key] = JSON.parse(row.valueJson);
        } catch {
          // A malformed live cell does not invalidate the remaining invoice data.
        }
      });
      const materialized = materializeLiveRoot(
        "antonelyPayableInvoiceLines",
        antonelyPayableInvoiceLines,
        values,
      );
      const normalized = normalizePayableInvoiceLines(materialized);
      if (normalized.length) {
        lines = normalized;
        const latestRow = liveRows.reduce((latest, row) => row.revision > latest.revision ? row : latest);
        metadata = {
          cutoff: latestRow.cutoff,
          sourceName: latestRow.sourceName,
          updatedAt: latestRow.updatedAt,
        };
      }
    }
  } catch {
    // The verified June source remains available if the live database is offline.
  }

  const response = Response.json(buildPayablesDataset(lines, metadata));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
