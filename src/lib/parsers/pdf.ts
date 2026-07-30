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
  // Some extractors glue adjacent columns together ("500.00786.84",
  // "10-Jun-2026IB/FTR/..."). Re-split money boundaries before line parsing.
  text = text.replace(/(\.\d{2})(?=[\d(])/g, "$1 ");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const datePrefix = /^((?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})|(?:\d{4}-\d{2}-\d{2})|(?:\d{1,2}[\s\/\-.]+[A-Za-z]{3,9}[\s\/\-.]+\d{2,4}))\s*(.+)$/;
  const numToken = /-?\(?[$€£₹]?\d[\d,]*\.?\d*\)?(?:\s?(?:cr|dr))?/gi;

  const bankName = detectBank(lines);
  const accountNumber = detectAccount(lines);

  // Opening balance ("Balance Forward 0.00 0.00 286.84") seeds the
  // balance-delta pass that decides debit vs credit per row.
  let openingBalance: number | null = null;
  for (const l of lines) {
    if (/balance\s+(forward|brought)|opening\s+balance|\bb\/f\b/i.test(l)) {
      const nums = [...l.matchAll(/-?\d[\d,]*\.\d{2}/g)].map((x) => parseAmount(x[0]));
      const last = nums.filter((v): v is number => v != null).at(-1);
      if (last != null) { openingBalance = last; break; }
    }
  }

  const out: Transaction[] = [];
  let pending: { date: string; parts: string[]; nums: string[] } | null = null;

  const flush = () => {
    if (!pending) return;
    const { date, parts, nums } = pending;
    pending = null;
    if (!nums.length) return;
    const decimalish = nums.filter((n) => /[.]\d{1,2}(?:\s?(?:cr|dr))?\)?$/i.test(n));
    const usable = decimalish.length >= 2 ? decimalish : nums;
    const values = usable.map(parseAmount).filter((v): v is number => v != null);
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
      // Footer / metadata sections end the transaction region of the page.
      if (/^ref\s*:|\*{3}|end of (the )?statement|customer id|account no|issue date|^currency\b|^swift\b|generated on/i.test(line)) {
        flush();
        continue;
      }
      const nums = [...line.matchAll(numToken)].map((x) => x[0]);
      if (nums.length && line.replace(numToken, "").trim().length < 4) {
        if (pending.nums.length >= 2) {
          flush();                             // already have amount+balance → this is a totals row
        } else {
          pending.nums.push(...nums);          // numeric continuation
        }
      } else if (!/page \d|statement|opening balance|closing balance|balance\s+(forward|brought)/i.test(line)) {
        pending.parts.push(line);              // wrapped description
      }
    }
  }
  flush();

  // Reconcile direction with running balances: prev + amount == balance means
  // money in; prev − amount == balance means money out. This overrides keyword
  // guesses and handles statements whose text layer gives no debit/credit column.
  let prev = openingBalance;
  for (const t of out) {
    const amt = t.debit + t.credit;
    if (t.balance != null && prev != null && amt > 0) {
      if (Math.abs(prev + amt - t.balance) < 0.011) {
        t.credit = amt; t.debit = 0; t.amount = amt; t.type = "credit";
      } else if (Math.abs(prev - amt - t.balance) < 0.011) {
        t.debit = amt; t.credit = 0; t.amount = -amt; t.type = "debit";
      } else {
        const delta = Math.round((t.balance - prev) * 100) / 100;
        if (delta !== 0) {
          const a = Math.abs(delta);
          if (delta > 0) { t.credit = a; t.debit = 0; t.amount = a; t.type = "credit"; }
          else { t.debit = a; t.credit = 0; t.amount = -a; t.type = "debit"; }
        }
      }
    }
    if (t.balance != null) prev = t.balance;
  }
  return out;
}

function detectBank(lines: string[]): string | null {
  const known = /(chase|bank of america|wells fargo|citibank|hdfc|icici|sbi|axis|hsbc|barclays|capital one|us bank|pnc|first meridian|brac bank|dutch-bangla|city bank|eastern bank|standard chartered|islami bank|sonali|janata|agrani)/i;
  const startsWithDate = /^\d{1,2}[\s\/\-.]/;
  // Header lines only — transaction rows mention counterparty banks and mislead.
  for (const l of lines) {
    if (startsWithDate.test(l)) continue;
    const m = l.match(known);
    if (m) return m[0].replace(/\b\w/g, (c) => c.toUpperCase());
  }
  for (const l of lines.slice(0, 20)) {
    if (!startsWithDate.test(l) && /\bbank\b/i.test(l) && l.length < 60) return l;
  }
  return null;
}

function detectAccount(lines: string[]): string | null {
  for (const l of lines) {
    const m = l.match(/acc(?:oun)?t\.?\s*(?:no\.?|number|#)?\s*[:\-]?\s*([X*\d][X*\d\s-]{5,})/i);
    if (m) return m[1].trim().replace(/\s+/g, "");
  }
  // Label and value on separate lines (common in tabular PDF text layers).
  const labelIdx = lines.findIndex((l) => /acc(?:oun)?t\.?\s*(?:no\.?|number)\s*:?\s*$/i.test(l));
  if (labelIdx >= 0) {
    const candidates = lines
      .slice(labelIdx + 1, labelIdx + 10)
      .filter((l) => /^[X*\d][X*\d-]{7,19}$/.test(l));
    if (candidates.length) return candidates.sort((a, b) => b.length - a.length)[0];
  }
  return null;
}
