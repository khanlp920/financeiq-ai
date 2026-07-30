import type { Transaction, TransactionType } from "@/lib/types";

export type RawRow = Record<string, string | number | null | undefined>;

const DATE_KEYS = ["date", "transaction date", "txn date", "value date", "posting date", "posted"];
const DESC_KEYS = ["description", "narration", "details", "particulars", "memo", "payee", "transaction details", "remarks"];
const AMOUNT_KEYS = ["amount", "transaction amount", "amt"];
const DEBIT_KEYS = ["debit", "withdrawal", "withdrawal amt", "withdrawal amount", "dr", "paid out", "money out", "debit amount"];
const CREDIT_KEYS = ["credit", "deposit", "deposit amt", "deposit amount", "cr", "paid in", "money in", "credit amount"];
const BALANCE_KEYS = ["balance", "closing balance", "running balance", "available balance", "bal"];
const ACCOUNT_KEYS = ["account", "account number", "account no", "acct"];
const BANK_KEYS = ["bank", "bank name"];
const TYPE_KEYS = ["type", "transaction type", "dr/cr", "cr/dr"];

function findKey(row: RawRow, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const hit = keys.find((k) => k.trim().toLowerCase() === c);
    if (hit) return hit;
  }
  // loose contains-match as fallback
  for (const c of candidates) {
    const hit = keys.find((k) => k.trim().toLowerCase().includes(c));
    if (hit) return hit;
  }
  return null;
}

export function parseAmount(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  const negParen = /^\(.*\)$/.test(s);
  const negSuffix = /(dr|debit)\.?$/i.test(s);
  s = s.replace(/[(),$€£₹\s]/g, "").replace(/(cr|dr|debit|credit)\.?$/i, "");
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return negParen || negSuffix ? -Math.abs(n) : n;
}

export function parseDate(v: string | number | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  // ISO already
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // dd/mm/yyyy or mm/dd/yyyy or with '-' '.'
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    const yy = y.length === 2 ? `20${y}` : y;
    let day = parseInt(a), mon = parseInt(b);
    if (mon > 12 && day <= 12) [day, mon] = [mon, day]; // clearly mm/dd swapped
    else if (day <= 12 && mon <= 12) {
      // ambiguous — assume dd/mm (most bank statements outside US); mm/dd still
      // parses correctly for unambiguous rows above.
      [day, mon] = [parseInt(a), parseInt(b)];
    }
    if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
    return `${yy}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  // "14 Mar 2026" / "Mar 14, 2026"
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/** Map an arbitrary statement row shape into our canonical transaction fields. */
export function normalizeRow(row: RawRow): Omit<Transaction, "id" | "statementId" | "category" | "merchant"> | null {
  const dateKey = findKey(row, DATE_KEYS);
  const descKey = findKey(row, DESC_KEYS);
  if (!dateKey || !descKey) return null;

  const date = parseDate(row[dateKey]);
  const description = String(row[descKey] ?? "").trim();
  if (!date || !description) return null;

  const debitKey = findKey(row, DEBIT_KEYS);
  const creditKey = findKey(row, CREDIT_KEYS);
  const amountKey = findKey(row, AMOUNT_KEYS);
  const typeKey = findKey(row, TYPE_KEYS);

  let debit = 0, credit = 0;
  const dv = debitKey ? parseAmount(row[debitKey]) : null;
  const cv = creditKey ? parseAmount(row[creditKey]) : null;

  if (dv != null || cv != null) {
    debit = Math.abs(dv ?? 0);
    credit = Math.abs(cv ?? 0);
  } else if (amountKey) {
    const a = parseAmount(row[amountKey]);
    if (a == null) return null;
    const typeHint = typeKey ? String(row[typeKey] ?? "").toLowerCase() : "";
    const isCredit = typeHint ? /cr|credit|deposit|in/.test(typeHint) : a > 0;
    if (isCredit) credit = Math.abs(a); else debit = Math.abs(a);
  } else {
    return null;
  }
  if (debit === 0 && credit === 0) return null;

  const balKey = findKey(row, BALANCE_KEYS);
  const acctKey = findKey(row, ACCOUNT_KEYS);
  const bankKey = findKey(row, BANK_KEYS);
  const type: TransactionType = credit > 0 && debit === 0 ? "credit" : "debit";

  return {
    date,
    description,
    amount: credit - debit,
    debit,
    credit,
    balance: balKey ? parseAmount(row[balKey]) : null,
    accountNumber: acctKey ? String(row[acctKey] ?? "").trim() || null : null,
    bankName: bankKey ? String(row[bankKey] ?? "").trim() || null : null,
    type,
  };
}
