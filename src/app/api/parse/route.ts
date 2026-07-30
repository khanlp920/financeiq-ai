import { NextResponse } from "next/server";
import { aiParse } from "@/lib/parsers/ai";
import { parsePdfText } from "@/lib/parsers/pdf";
import { detectCurrencyFromText, type CurrencyCode } from "@/lib/currency";
import type { Transaction } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SIZE = 15 * 1024 * 1024;

/**
 * POST multipart/form-data { file, statementId } → { transactions, engine }.
 *
 * Strategy:
 *  1. PDF → pdf-parse text → deterministic heuristic parser (free, instant).
 *  2. If that finds too few rows — unusual layout or a scanned statement —
 *     and ANTHROPIC_API_KEY is set, the file goes to Claude, which reads any
 *     bank's format (vision handles scans). CSV/Excel land here too when the
 *     in-browser parsers fail on a nonstandard export.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const statementId = String(form.get("statementId") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds the 15 MB limit." }, { status: 413 });
    }

    const name = file.name.toLowerCase();
    const isPdf = name.endsWith(".pdf");
    const isText = name.endsWith(".csv") || name.endsWith(".txt");
    const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");
    if (!isPdf && !isText && !isExcel) {
      return NextResponse.json({ error: "Unsupported file type. Use PDF, CSV or Excel." }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let transactions: Transaction[] = [];
    let engine: "rules" | "ai" = "rules";
    let currency: CurrencyCode | null = null;

    if (isPdf) {
      try {
        const { default: pdfParse } = await import("pdf-parse");
        const parsed = await pdfParse(buffer);
        currency = detectCurrencyFromText(parsed.text ?? "");
        transactions = parsePdfText(parsed.text ?? "", statementId);
      } catch {
        transactions = []; // encrypted/scanned — AI fallback below
      }
    } else {
      currency = detectCurrencyFromText(buffer.toString("utf8").slice(0, 20_000));
    }

    // Fallback: unusual layout, scanned PDF, or a CSV/Excel the client couldn't read.
    if (transactions.length < 3) {
      let aiInput: { buffer: Buffer; mediaType: "application/pdf" | "text/plain"; text?: string };
      if (isPdf) {
        aiInput = { buffer, mediaType: "application/pdf" };
      } else if (isExcel) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(buffer, { type: "buffer" });
        const text = wb.SheetNames
          .map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n]))
          .join("\n\n");
        aiInput = { buffer, mediaType: "text/plain", text };
      } else {
        aiInput = { buffer, mediaType: "text/plain" };
      }

      const ai = await aiParse(aiInput, statementId);
      if (ai && ai.rows.length) {
        transactions = ai.rows;
        currency = ai.currency ?? currency;
        engine = "ai";
      } else if (!transactions.length) {
        const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
        return NextResponse.json(
          {
            error: hasKey
              ? "Couldn't extract transactions from this file — it may be empty, password-protected, or not a statement."
              : "This statement's layout isn't recognized by the built-in parser. Add ANTHROPIC_API_KEY to enable AI parsing of any bank format, or export CSV from your bank.",
          },
          { status: 422 }
        );
      }
    }

    return NextResponse.json({ transactions, engine, currency });
  } catch (err) {
    console.error("[/api/parse]", err);
    return NextResponse.json({ error: "Parsing failed unexpectedly. Try a CSV export from your bank." }, { status: 500 });
  }
}
