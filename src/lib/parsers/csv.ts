import Papa from "papaparse";
import { enrich } from "@/lib/categorize";
import { uid } from "@/lib/utils";
import type { Transaction } from "@/lib/types";
import { normalizeRow, type RawRow } from "@/lib/parsers/normalize";

/** Parse a CSV bank statement (any common column layout). */
export async function parseCsv(file: File, statementId: string): Promise<Transaction[]> {
  const text = await file.text();
  return parseCsvText(text, statementId);
}

export function parseCsvText(text: string, statementId: string): Transaction[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const rows: Transaction[] = [];
  for (const raw of result.data) {
    const norm = normalizeRow(raw as RawRow);
    if (!norm) continue;
    rows.push(
      enrich({
        id: uid(),
        statementId,
        ...norm,
      })
    );
  }
  return rows;
}
