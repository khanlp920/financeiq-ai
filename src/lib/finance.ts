import { monthKey, monthLabel } from "@/lib/utils";
import type {
  CategoryAggregate, Category, KpiSummary, MerchantAggregate,
  MonthlyAggregate, Transaction, TransactionFilters,
} from "@/lib/types";

/** ── Filtering ──────────────────────────────────────────────────────────── */

export function applyFilters(txns: Transaction[], f: TransactionFilters): Transaction[] {
  const q = f.query.trim().toLowerCase();
  return txns.filter((t) => {
    if (q && !(`${t.description} ${t.merchant} ${t.category} ${t.bankName ?? ""}`.toLowerCase().includes(q))) return false;
    if (f.category !== "all" && t.category !== f.category) return false;
    if (f.type !== "all" && t.type !== f.type) return false;
    if (f.merchant !== "all" && t.merchant !== f.merchant) return false;
    if (f.dateFrom && t.date < f.dateFrom) return false;
    if (f.dateTo && t.date > f.dateTo) return false;
    const abs = Math.abs(t.amount);
    if (f.amountMin != null && abs < f.amountMin) return false;
    if (f.amountMax != null && abs > f.amountMax) return false;
    return true;
  });
}

export function sortByDateDesc(txns: Transaction[]): Transaction[] {
  return [...txns].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** ── KPIs ───────────────────────────────────────────────────────────────── */

export function computeKpis(txns: Transaction[]): KpiSummary {
  let income = 0, expense = 0;
  for (const t of txns) { income += t.credit; expense += t.debit; }
  const net = income - expense;
  const months = monthlyAggregates(txns);
  const burn = months.length ? expense / months.length : 0;
  const withBal = sortByDateDesc(txns).find((t) => t.balance != null);
  const balance = withBal?.balance ?? net;
  return {
    totalIncome: income,
    totalExpense: expense,
    netSavings: net,
    savingsRate: income > 0 ? net / income : 0,
    currentBalance: balance,
    monthlyBurnRate: burn,
  };
}

/** ── Aggregations ───────────────────────────────────────────────────────── */

export function monthlyAggregates(txns: Transaction[]): MonthlyAggregate[] {
  const map = new Map<string, MonthlyAggregate>();
  for (const t of txns) {
    const key = monthKey(t.date);
    const m = map.get(key) ?? { month: key, label: monthLabel(key), income: 0, expense: 0, net: 0, endBalance: null };
    m.income += t.credit;
    m.expense += t.debit;
    map.set(key, m);
  }
  const list = [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  for (const m of list) m.net = m.income - m.expense;
  // end-of-month balance from last balance-bearing txn in that month
  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    if (t.balance == null) continue;
    const m = map.get(monthKey(t.date));
    if (m) m.endBalance = t.balance;
  }
  return list;
}

export function categoryAggregates(txns: Transaction[]): CategoryAggregate[] {
  const map = new Map<Category, CategoryAggregate>();
  let totalExpense = 0;
  for (const t of txns) {
    if (t.debit <= 0) continue;
    totalExpense += t.debit;
    const c = map.get(t.category) ?? { category: t.category, total: 0, count: 0, share: 0 };
    c.total += t.debit; c.count += 1;
    map.set(t.category, c);
  }
  const list = [...map.values()].sort((a, b) => b.total - a.total);
  for (const c of list) c.share = totalExpense > 0 ? c.total / totalExpense : 0;
  return list;
}

export function merchantAggregates(txns: Transaction[], limit = 10): MerchantAggregate[] {
  const map = new Map<string, MerchantAggregate>();
  for (const t of txns) {
    if (t.debit <= 0 || t.category === "Transfer") continue;
    const m = map.get(t.merchant) ?? { merchant: t.merchant, total: 0, count: 0, category: t.category };
    m.total += t.debit; m.count += 1;
    map.set(t.merchant, m);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

/** Daily net spend keyed by ISO date (for heatmap + trends). */
export function dailySpend(txns: Transaction[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.debit <= 0) continue;
    map.set(t.date, (map.get(t.date) ?? 0) + t.debit);
  }
  return map;
}

/** Cumulative balance timeline. Uses statement balance when present, else running net. */
export function balanceHistory(txns: Transaction[]): { date: string; balance: number }[] {
  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
  const out: { date: string; balance: number }[] = [];
  let running = 0;
  const hasStatementBalance = sorted.some((t) => t.balance != null);
  let last: number | null = null;
  for (const t of sorted) {
    running += t.amount;
    const v: number = hasStatementBalance ? (t.balance ?? last ?? running) : running;
    last = v;
    if (out.length && out[out.length - 1].date === t.date) out[out.length - 1].balance = v;
    else out.push({ date: t.date, balance: v });
  }
  return out;
}

/** 7-day rolling average of daily spending. */
export function spendingTrend(txns: Transaction[]): { date: string; spend: number; avg7: number }[] {
  const daily = dailySpend(txns);
  const dates = [...daily.keys()].sort();
  if (!dates.length) return [];
  const out: { date: string; spend: number; avg7: number }[] = [];
  const window: number[] = [];
  // fill missing days with 0 so the rolling average is honest
  const start = new Date(dates[0] + "T00:00:00");
  const end = new Date(dates[dates.length - 1] + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const spend = daily.get(iso) ?? 0;
    window.push(spend);
    if (window.length > 7) window.shift();
    out.push({ date: iso, spend, avg7: window.reduce((a, b) => a + b, 0) / window.length });
  }
  return out;
}

export function uniqueMerchants(txns: Transaction[]): string[] {
  return [...new Set(txns.map((t) => t.merchant))].sort();
}
