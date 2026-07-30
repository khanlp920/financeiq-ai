import { categoryAggregates, computeKpis, merchantAggregates, monthlyAggregates } from "@/lib/finance";
import { detectRecurring, healthScore } from "@/lib/insights";
import type { Transaction } from "@/lib/types";

/**
 * Compact JSON summary of the user's finances, sent with every chat request.
 * Keeps token usage low while giving the model everything it needs to answer
 * concrete questions; also consumed by the deterministic local answer engine.
 */
export function buildChatContext(transactions: Transaction[]) {
  const kpi = computeKpis(transactions);
  const months = monthlyAggregates(transactions).slice(-12);
  const cats = categoryAggregates(transactions).slice(0, 12);
  const merchants = merchantAggregates(transactions, 10);
  const recurring = detectRecurring(transactions).slice(0, 12);
  const health = healthScore(transactions);

  // Per-month category spend for "food last month" style questions.
  const monthCategory: Record<string, Record<string, number>> = {};
  for (const t of transactions) {
    if (t.debit <= 0) continue;
    const mk = t.date.slice(0, 7);
    (monthCategory[mk] ??= {})[t.category] = ((monthCategory[mk] ?? {})[t.category] ?? 0) + t.debit;
  }
  const monthKeys = Object.keys(monthCategory).sort().slice(-12);
  const byMonthCategory = Object.fromEntries(
    monthKeys.map((k) => [k, Object.fromEntries(
      Object.entries(monthCategory[k]).map(([c, v]) => [c, Math.round(v * 100) / 100])
    )])
  );

  const largest = transactions
    .filter((t) => t.debit > 0)
    .sort((a, b) => b.debit - a.debit)
    .slice(0, 5)
    .map((t) => ({ date: t.date, merchant: t.merchant, amount: t.debit, category: t.category }));

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    txnCount: transactions.length,
    kpi,
    months,
    categories: cats,
    topMerchants: merchants,
    recurring,
    health: { score: health.score, grade: health.grade },
    byMonthCategory,
    largestExpenses: largest,
  };
}

export type ChatContext = ReturnType<typeof buildChatContext>;
