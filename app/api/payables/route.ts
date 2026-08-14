import { requireApiUser } from "../../../lib/access-control";
import { conditionalJson } from "../../../lib/conditional-json";
import { readEffectiveLiveData } from "../../../lib/effective-live-data";
import { materializeLiveRoot } from "../../../lib/live-data";
import {
  antonelyPayableInvoiceLines,
  buildPayablesDataset,
  normalizePayableInvoiceLines,
} from "../../antonely-payable-invoices";

export const runtime = "edge";

export async function GET(request: Request) {
  const auth = await requireApiUser({ finance: true });
  if (!auth.user) return auth.response;

  let lines = antonelyPayableInvoiceLines;
  let metadata: {
    cutoff?: string;
    sourceName?: string;
    updatedAt?: string;
  } = {};

  try {
    const live = await readEffectiveLiveData(true);
    const liveRows = live.points.filter((row) =>
      row.key === "antonelyPayableInvoiceLines" ||
      row.key.startsWith("antonelyPayableInvoiceLines."));
    if (liveRows.length) {
      const materialized = materializeLiveRoot(
        "antonelyPayableInvoiceLines",
        antonelyPayableInvoiceLines,
        live.values,
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

  return conditionalJson(request, buildPayablesDataset(lines, metadata));
}
