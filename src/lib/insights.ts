import { categoryAggregates, computeKpis, monthlyAggregates } from "@/lib/finance";
import { clamp, fmtMoney, fmtPct, monthLabel } from "@/lib/utils";
import type { HealthScore, Insight, Transaction } from "@/lib/types";

/**
 * Deterministic insight engine. Every insight is computed from the data —
 * no hallucination risk — and rendered as ranked, severity-tagged cards.
 */
export function generateInsights(txns: Transaction[]): Insight[] {
  if (!txns.length) return [];
  const out: Insight[] = [];
  const kpi = computeKpis(txns);
  const months = monthlyAggregates(txns);
  const cats = categoryAggregates(txns);
  let id = 0;
  const push = (i: Omit<Insight, "id">) => out.push({ id: `ins-${id++}`, ...i });

  // Highest spending category
  if (cats[0]) {
    push({
      kind: "highlight", severity: "info",
      title: "Highest spending category",
      body: `${cats[0].category} leads your spending at ${fmtMoney(cats[0].total)} across ${cats[0].count} transactions — ${fmtPct(cats[0].share)} of all expenses.`,
      value: fmtMoney(cats[0].total),
    });
  }

  // Largest transaction
  const largest = [...txns].filter((t) => t.debit > 0).sort((a, b) => b.debit - a.debit)[0];
  if (largest) {
    push({
      kind: "highlight", severity: "info",
      title: "Largest transaction",
      body: `${fmtMoney(largest.debit)} to ${largest.merchant} on ${largest.date} (${largest.category}).`,
      value: fmtMoney(largest.debit),
    });
  }

  // Averages
  if (months.length) {
    const avgIncome = kpi.totalIncome / months.length;
    const avgExpense = kpi.totalExpense / months.length;
    push({
      kind: "highlight", severity: "info",
      title: "Monthly averages",
      body: `You average ${fmtMoney(avgIncome)} in and ${fmtMoney(avgExpense)} out per month — a typical monthly surplus of ${fmtMoney(avgIncome - avgExpense)}.`,
    });
  }

  // Year over year comparison
  const byYear = new Map<string, { income: number; expense: number }>();
  for (const m of months) {
    const y = m.month.slice(0, 4);
    const v = byYear.get(y) ?? { income: 0, expense: 0 };
    v.income += m.income; v.expense += m.expense;
    byYear.set(y, v);
  }
  const years = [...byYear.keys()].sort();
  if (years.length >= 2) {
    const [prev, curr] = [byYear.get(years[years.length - 2])!, byYear.get(years[years.length - 1])!];
    const delta = prev.expense > 0 ? (curr.expense - prev.expense) / prev.expense : 0;
    push({
      kind: "comparison", severity: delta > 0.1 ? "warn" : "good",
      title: `Spending ${delta >= 0 ? "up" : "down"} ${fmtPct(Math.abs(delta))} vs ${years[years.length - 2]}`,
      body: `${years[years.length - 1]} expenses so far: ${fmtMoney(curr.expense)} vs ${fmtMoney(prev.expense)} in ${years[years.length - 2]}.`,
    });
  }

  // Weekend vs weekday spending
  let weekend = 0, weekday = 0, weDays = 0, wdDays = 0;
  const seen = new Set<string>();
  for (const t of txns) {
    if (t.debit <= 0) continue;
    const dow = new Date(t.date + "T00:00:00").getDay();
    const isWe = dow === 0 || dow === 6;
    if (isWe) weekend += t.debit; else weekday += t.debit;
    const k = t.date;
    if (!seen.has(k)) { seen.add(k); if (isWe) weDays++; else wdDays++; }
  }
  if (weDays && wdDays) {
    const wePerDay = weekend / weDays, wdPerDay = weekday / wdDays;
    const ratio = wdPerDay > 0 ? wePerDay / wdPerDay : 1;
    push({
      kind: "highlight", severity: ratio > 1.5 ? "warn" : "info",
      title: "Weekend spending pattern",
      body: `Weekend days average ${fmtMoney(wePerDay)} vs ${fmtMoney(wdPerDay)} on weekdays (${ratio.toFixed(1)}×).`,
    });
  }

  // Subscriptions / recurring payments: same merchant, similar amount, ≥3 distinct months
  const rec = detectRecurring(txns);
  for (const r of rec.slice(0, 5)) {
    push({
      kind: "subscription", severity: "info",
      title: `Recurring: ${r.merchant}`,
      body: `${fmtMoney(r.amount)} charged in ${r.months} different months (${r.category}). Annualized: ${fmtMoney(r.amount * 12)}.`,
      value: `${fmtMoney(r.amount)}/mo`,
    });
  }
  if (rec.length) {
    const total = rec.reduce((s, r) => s + r.amount, 0);
    push({
      kind: "opportunity", severity: "good",
      title: "Subscription audit opportunity",
      body: `${rec.length} recurring payments total ${fmtMoney(total)}/month (${fmtMoney(total * 12)}/year). Cancelling even two rarely-used ones is the fastest savings win.`,
    });
  }

  // Possible duplicates: same day + merchant + amount, count > 1
  const dupKey = new Map<string, Transaction[]>();
  for (const t of txns) {
    if (t.debit <= 0) continue;
    const k = `${t.date}|${t.merchant}|${t.debit.toFixed(2)}`;
    dupKey.set(k, [...(dupKey.get(k) ?? []), t]);
  }
  for (const [, list] of dupKey) {
    if (list.length > 1) {
      const t = list[0];
      push({
        kind: "duplicate", severity: "warn",
        title: "Possible duplicate charge",
        body: `${list.length}× ${fmtMoney(t.debit)} to ${t.merchant} on ${t.date}. Verify this wasn't billed twice.`,
      });
    }
  }

  // Anomalies: debit > mean + 2.5σ of category
  const catStats = new Map<string, number[]>();
  for (const t of txns) if (t.debit > 0) catStats.set(t.category, [...(catStats.get(t.category) ?? []), t.debit]);
  for (const t of txns) {
    if (t.debit <= 0) continue;
    const arr = catStats.get(t.category)!;
    if (arr.length < 6) continue;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
    if (sd > 0 && t.debit > mean + 2.5 * sd && t.debit > 100) {
      push({
        kind: "anomaly", severity: "warn",
        title: `Unusual ${t.category} charge`,
        body: `${fmtMoney(t.debit)} at ${t.merchant} on ${t.date} is ${(t.debit / mean).toFixed(1)}× your typical ${t.category} transaction (${fmtMoney(mean)}).`,
      });
      if (out.filter((i) => i.kind === "anomaly").length >= 4) break;
    }
  }

  // Savings opportunity: top discretionary category trim
  const discretionary = cats.find((c) => ["Shopping", "Entertainment", "Food"].includes(c.category));
  if (discretionary && months.length) {
    const perMonth = discretionary.total / months.length;
    push({
      kind: "opportunity", severity: "good",
      title: `Trim ${discretionary.category} by 15%`,
      body: `${discretionary.category} runs ${fmtMoney(perMonth)}/month. A 15% trim frees ${fmtMoney(perMonth * 0.15)}/month — ${fmtMoney(perMonth * 0.15 * 12)}/year toward savings.`,
    });
  }

  // Savings rate verdict
  push({
    kind: "health",
    severity: kpi.savingsRate >= 0.2 ? "good" : kpi.savingsRate >= 0.05 ? "info" : "bad",
    title: `Savings rate: ${fmtPct(kpi.savingsRate, 1)}`,
    body: kpi.savingsRate >= 0.2
      ? "Excellent — you're above the 20% benchmark financial planners recommend."
      : kpi.savingsRate >= 0.05
      ? "Below the recommended 20%. Targeting recurring costs is usually the easiest lever."
      : "Spending nearly equals (or exceeds) income. Prioritize a budget for your top 3 categories.",
  });

  const order = { bad: 0, warn: 1, good: 2, info: 3 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

export interface RecurringPayment {
  merchant: string; amount: number; months: number; category: Transaction["category"];
}

/** Same merchant, amount within ±8%, hit in ≥3 distinct months. */
export function detectRecurring(txns: Transaction[]): RecurringPayment[] {
  const byMerchant = new Map<string, Transaction[]>();
  for (const t of txns) {
    if (t.debit <= 0 || t.category === "Transfer" || t.category === "ATM Withdrawal") continue;
    byMerchant.set(t.merchant, [...(byMerchant.get(t.merchant) ?? []), t]);
  }
  const out: RecurringPayment[] = [];
  for (const [merchant, list] of byMerchant) {
    if (list.length < 3) continue;
    const median = [...list].sort((a, b) => a.debit - b.debit)[Math.floor(list.length / 2)].debit;
    const similar = list.filter((t) => Math.abs(t.debit - median) / median <= 0.08);
    const months = new Set(similar.map((t) => t.date.slice(0, 7)));
    if (similar.length >= 3 && months.size >= 3) {
      out.push({ merchant, amount: median, months: months.size, category: similar[0].category });
    }
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/** Composite 0–100 financial health score. */
export function healthScore(txns: Transaction[]): HealthScore {
  const kpi = computeKpis(txns);
  const months = monthlyAggregates(txns);
  const cats = categoryAggregates(txns);

  // 1. Savings rate (40%)
  const sSave = clamp(kpi.savingsRate / 0.3, 0, 1) * 100;
  // 2. Spending stability — inverse coefficient of variation of monthly expense (25%)
  let sStable = 50;
  if (months.length >= 3) {
    const ex = months.map((m) => m.expense);
    const mean = ex.reduce((a, b) => a + b, 0) / ex.length;
    const sd = Math.sqrt(ex.reduce((a, b) => a + (b - mean) ** 2, 0) / ex.length);
    sStable = clamp(1 - (mean > 0 ? sd / mean : 1), 0, 1) * 100;
  }
  // 3. Category concentration — top category share (15%)
  const sDiverse = cats[0] ? clamp(1 - (cats[0].share - 0.25) / 0.5, 0, 1) * 100 : 70;
  // 4. Positive months ratio (20%)
  const pos = months.filter((m) => m.net > 0).length;
  const sPos = months.length ? (pos / months.length) * 100 : 50;

  const components = [
    { label: "Savings rate", score: Math.round(sSave), weight: 0.4, detail: `${fmtPct(kpi.savingsRate, 1)} of income saved (target ≥ 20%).` },
    { label: "Spending stability", score: Math.round(sStable), weight: 0.25, detail: "How consistent monthly spending is across the period." },
    { label: "Category balance", score: Math.round(sDiverse), weight: 0.15, detail: cats[0] ? `${cats[0].category} takes ${fmtPct(cats[0].share)} of spend.` : "Spending diversification." },
    { label: "Surplus months", score: Math.round(sPos), weight: 0.2, detail: `${pos}/${months.length} months ended cash-positive.` },
  ];
  const score = Math.round(components.reduce((s, c) => s + c.score * c.weight, 0));
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
  return { score, grade, components };
}
