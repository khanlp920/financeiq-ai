import * as XLSX from "xlsx";
import { enrich } from "@/lib/categorize";
import { uid } from "@/lib/utils";
import type { Transaction } from "@/lib/types";
import { normalizeRow, type RawRow } from "@/lib/parsers/normalize";

/** Parse an Excel bank statement: first sheet, header row auto-detected. */
export async function parseXlsx(file: File, statementId: string): Promise<Transaction[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  // Find the header row: first row containing a date-ish and description-ish cell
  const grid: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
  let headerIdx = 0;
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const cells = (grid[i] ?? []).map((c) => String(c ?? "").toLowerCase());
    if (cells.some((c) => c.includes("date")) && cells.some((c) => /desc|narration|particular|detail|memo/.test(c))) {
      headerIdx = i; break;
    }
  }
  const header = (grid[headerIdx] ?? []).map((c) => String(c ?? "").trim());
  const rows: Transaction[] = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const raw: RawRow = {};
    header.forEach((h, j) => { if (h) raw[h] = grid[i]?.[j] ?? null; });
    const norm = normalizeRow(raw);
    if (!norm) continue;
    rows.push(enrich({ id: uid(), statementId, ...norm }));
  }
  return rows;
}
