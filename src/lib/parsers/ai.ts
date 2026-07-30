/**
 * AI fallback parser — runs server-side only.
 *
 * When the deterministic parsers can't read a statement (unusual bank layout,
 * scanned/image PDF, odd CSV), the raw file is sent to Claude, which returns
 * structured rows. PDFs are passed as documents so vision handles scans too.
 * Requires ANTHROPIC_API_KEY; without it the caller simply reports "no rows".
 */
import { enrich } from "@/lib/categorize";
import type { Transaction } from "@/lib/types";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";

interface AiRow {
  date?: string;
  description?: string;
  debit?: number | string | null;
  credit?: number | string | null;
  balance?: number | string | null;
  accountNumber?: string | null;
  bankName?: string | null;
}

const SYSTEM = `You extract transactions from bank statements of ANY bank, ANY country, ANY layout (tables, text, scanned pages).

Return ONLY a JSON object — no markdown, no commentary — shaped exactly:
{"bankName": string|null, "accountNumber": string|null, "currency": ISO-4217 string|null, "transactions": [{"date": "YYYY-MM-DD", "description": string, "debit": number|null, "credit": number|null, "balance": number|null}]}

Rules:
- Every transaction row in the document must appear, in statement order. Skip headers, totals, opening/closing balance summary lines, marketing text.
- Convert all dates to YYYY-MM-DD. Infer year from statement context when a row omits it.
- debit = money OUT (withdrawals, payments, fees). credit = money IN (deposits, salary, refunds). Exactly one of debit/credit per row; the other null. Never negative numbers.
- Strip currency symbols and thousands separators; numbers only.
- balance = running balance for that row if shown, else null.
- accountNumber: as printed (masking kept). bankName: the issuing bank if identifiable.
- If the document contains no transactions at all, return {"bankName":null,"accountNumber":null,"transactions":[]}.`;

export async function aiParse(
  file: { buffer: Buffer; mediaType: "application/pdf" | "text/plain"; text?: string },
  statementId: string
): Promise<{ rows: Transaction[]; currency: CurrencyCode | null } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const content: unknown[] =
    file.mediaType === "application/pdf"
      ? [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: file.buffer.toString("base64") },
          },
          { type: "text", text: "Extract every transaction from this bank statement." },
        ]
      : [
          {
            type: "text",
            text: `Extract every transaction from this bank statement export:\n\n${(file.text ?? file.buffer.toString("utf8")).slice(0, 150_000)}`,
          },
        ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 16_000,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    console.error("[aiParse] Anthropic error", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const raw = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  let parsed: { bankName?: string | null; accountNumber?: string | null; currency?: string | null; transactions?: AiRow[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Model sometimes wraps JSON in prose — grab the outermost object.
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { parsed = JSON.parse(match[0]); } catch { return null; }
  }

  const rows = Array.isArray(parsed.transactions) ? parsed.transactions : [];
  const num = (v: number | string | null | undefined): number => {
    if (v == null) return 0;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const out: Transaction[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const date = typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null;
    const description = typeof r.description === "string" ? r.description.trim() : "";
    const debit = num(r.debit);
    const credit = num(r.credit);
    if (!date || !description || (debit === 0 && credit === 0)) continue;
    const type = credit > 0 ? "credit" : "debit";
    const balRaw = r.balance == null ? null : Number(String(r.balance).replace(/[^0-9.-]/g, ""));
    out.push(
      enrich({
        id: `${statementId}-ai-${i}`,
        date,
        description,
        amount: type === "credit" ? credit : -debit,
        debit: type === "debit" ? debit : 0,
        credit: type === "credit" ? credit : 0,
        balance: balRaw != null && Number.isFinite(balRaw) ? balRaw : null,
        accountNumber: r.accountNumber ?? parsed.accountNumber ?? null,
        bankName: r.bankName ?? parsed.bankName ?? null,
        type,
        statementId,
      })
    );
  }
  const cur = parsed.currency && parsed.currency.toUpperCase() in CURRENCIES
    ? (parsed.currency.toUpperCase() as CurrencyCode)
    : null;
  return { rows: out, currency: cur };
}
