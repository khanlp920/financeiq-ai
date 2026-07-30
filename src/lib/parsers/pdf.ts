import { enrich } from "@/lib/categorize";
import { uid } from "@/lib/utils";
import type { Transaction } from "@/lib/types";
import { parseAmount, parseDate } from "@/lib/parsers/normalize";

/**
 * Heuristic text-layer PDF statement parser (server-side; text extracted by
 * /api/parse with pdf-parse). Handles the dominant layout:
 *
 *   <date> <description...> <amount> [<amount>] [<balance>]
 *
 * Rules:
 * - A line starts a transaction when it begins with a recognizable date.
 * - Continuation lines (no leading date) are appended to the description.
 * - Trailing numbers: 1 → amount (sign/keywords decide direction),
 *   2 → amount + balance, 3 → debit + credit + balance.
 */
export function parsePdfText(text: string, statementId: string): Transaction[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const datePrefix = /^((?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})|(?:\d{4}-\d{2}-\d{2})|(?:\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}))\s+(.*)$/;
  const numToken = /-?\(?[$€£₹]?\d[\d,]*\.?\d*\)?(?:\s?(?:cr|dr))?/gi;

  const bankName = detectBank(lines);
  const accountNumber = detectAccount(lines);

  const out: Transaction[] = [];
  let pending: { date: string; parts: string[]; nums: string[] } | null = null;

  const flush = () => {
    if (!pending) return;
    const { date, parts, nums } = pending;
    pending = null;
    if (!nums.length) return;
    const values = nums.map(parseAmount).filter((v): v is number => v != null);
    if (!values.length) return;

    let debit = 0, credit = 0, balance: number | null = null;
    const desc = parts.join(" ").replace(/\s{2,}/g, " ").trim();
    const creditHint = /(salary|deposit|credit|refund|received|interest|reversal|cr\b)/i.test(desc);

    if (values.length >= 3) {
      const [d, c, b] = values.slice(-3);
      debit = Math.abs(d); credit = Math.abs(c); balance = b;
      if (debit > 0 && credit > 0) { if (creditHint) debit = 0; else credit = 0; }
    } else if (values.length === 2) {
      const [a, b] = values.slice(-2);
      balance = b;
      if (a < 0) debit = Math.abs(a);
      else if (creditHint) credit = a;
      else debit = a;
    } else {
      const a = values[0];
      if (a < 0) debit = Math.abs(a);
      else if (creditHint) credit = a;
      else debit = a;
    }
    if (debit === 0 && credit === 0) return;
    if (!desc) return;

    out.push(
      enrich({
        id: uid(),
        statementId,
        date,
        description: desc,
        amount: credit - debit,
        debit, credit, balance,
        accountNumber, bankName,
        type: credit > 0 && debit === 0 ? "credit" : "debit",
      })
    );
  };

  for (const line of lines) {
    const m = line.match(datePrefix);
    if (m) {
      flush();
      const date = parseDate(m[1]);
      if (!date) continue;
      const rest = m[2];
      const nums = [...rest.matchAll(numToken)].map((x) => x[0]);
      // description = rest minus trailing numeric tokens
      let desc = rest;
      for (let i = nums.length - 1; i >= 0; i--) {
        const idx = desc.lastIndexOf(nums[i]);
        if (idx >= 0 && idx > desc.length - nums[i].length - 4) desc = desc.slice(0, idx);
      }
      pending = { date, parts: [desc.trim()], nums: nums.slice(-3) };
    } else if (pending) {
      const nums = [...line.matchAll(numToken)].map((x) => x[0]);
      if (nums.length && line.replace(numToken, "").trim().length < 4) {
        pending.nums.push(...nums);            // numeric continuation
      } else if (!/page \d|statement|opening balance|closing balance/i.test(line)) {
        pending.parts.push(line);              // wrapped description
      }
    }
  }
  flush();
  return out;
}

function detectBank(lines: string[]): string | null {
  const known = /(chase|bank of america|wells fargo|citibank|hdfc|icici|sbi|axis|hsbc|barclays|capital one|us bank|pnc|first meridian)/i;
  for (const l of lines.slice(0, 20)) {
    const m = l.match(known);
    if (m) return m[0].replace(/\b\w/g, (c) => c.toUpperCase());
    if (/\bbank\b/i.test(l) && l.length < 60) return l;
  }
  return null;
}

function detectAccount(lines: string[]): string | null {
  for (const l of lines.slice(0, 40)) {
    const m = l.match(/acc(?:oun)?t\.?\s*(?:no\.?|number|#)?\s*[:\-]?\s*([X*\d][X*\d\s-]{5,})/i);
    if (m) return m[1].trim().replace(/\s+/g, "");
  }
  return null;
}
