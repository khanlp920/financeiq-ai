import { balanceHistory, dailySpend, monthlyAggregates } from "@/lib/finance";
import { monthLabel } from "@/lib/utils";
import type { Prediction, Transaction } from "@/lib/types";

/**
 * Prediction engine.
 *
 * - End-of-month spend: blends month-to-date daily burn with the trailing
 *   3-month average, weighted by how far into the month we are.
 * - Balance forecast: projects daily using recent burn ± 1σ band.
 * - Future savings: least-squares trend over monthly net.
 */
export function predict(txns: Transaction[], today = new Date()): Prediction | null {
  if (!txns.length) return null;

  const months = monthlyAggregates(txns);
  const lastDataDate = [...txns].map((t) => t.date).sort().at(-1)!;
  const anchor = new Date(lastDataDate + "T00:00:00");
  const ref = anchor < today ? anchor : today;

  const curKey = ref.toISOString().slice(0, 7);
  const dayOfMonth = ref.getDate();
  const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();

  const cur = months.find((m) => m.month === curKey);
  const prior = months.filter((m) => m.month < curKey).slice(-3);
  const priorAvg = prior.length ? prior.reduce((s, m) => s + m.expense, 0) / prior.length : cur?.expense ?? 0;

  const spendToDate = cur?.expense ?? 0;
  const mtdDaily = dayOfMonth > 0 ? spendToDate / dayOfMonth : 0;
  const progress = dayOfMonth / daysInMonth;
  // Early in month, trust history; late in month, trust actuals.
  const blendedMonthSpend = progress * (mtdDaily * daysInMonth) + (1 - progress) * priorAvg;

  // Daily burn σ from last 60 days of daily spend
  const daily = [...dailySpend(txns).entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-60).map(([, v]) => v);
  const meanDaily = daily.length ? daily.reduce((a, b) => a + b, 0) / daily.length : mtdDaily;
  const sd = daily.length ? Math.sqrt(daily.reduce((a, b) => a + (b - meanDaily) ** 2, 0) / daily.length) : 0;

  // Expected income for remainder of month (avg of prior months' income, prorated)
  const priorIncome = prior.length ? prior.reduce((s, m) => s + m.income, 0) / prior.length : cur?.income ?? 0;
  const incomeRemaining = Math.max(0, priorIncome - (cur?.income ?? 0));

  const hist = balanceHistory(txns);
  const startBalance = hist.at(-1)?.balance ?? 0;
  const daysLeft = daysInMonth - dayOfMonth;
  const dailyBurn = blendedMonthSpend / daysInMonth;
  const dailyIncome = incomeRemaining / Math.max(1, daysLeft);

  const forecast: Prediction["forecast"] = [];
  let projected = startBalance;
  for (let i = 1; i <= daysLeft; i++) {
    const d = new Date(ref); d.setDate(ref.getDate() + i);
    projected += dailyIncome - dailyBurn;
    const spread = sd * Math.sqrt(i);
    forecast.push({
      date: d.toISOString().slice(0, 10),
      projectedBalance: Math.round(projected),
      low: Math.round(projected - spread),
      high: Math.round(projected + spread),
    });
  }

  // Future savings: linear trend on monthly net
  const nets = months.map((m) => m.net);
  const n = nets.length;
  let slope = 0, intercept = nets.at(-1) ?? 0;
  if (n >= 2) {
    const xs = nets.map((_, i) => i);
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = nets.reduce((a, b) => a + b, 0) / n;
    const denom = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    slope = denom ? xs.reduce((s, x, i) => s + (x - mx) * (nets[i] - my), 0) / denom : 0;
    intercept = my - slope * mx;
  }
  const futureSavings: Prediction["futureSavings"] = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth() + i, 1);
    const key = d.toISOString().slice(0, 7);
    futureSavings.push({
      month: key,
      label: monthLabel(key),
      projectedSavings: Math.round(intercept + slope * (n - 1 + i)),
    });
  }

  return {
    endOfMonthBalance: forecast.at(-1)?.projectedBalance ?? startBalance,
    expectedMonthSpend: Math.round(blendedMonthSpend),
    spendToDate: Math.round(spendToDate),
    dailyBurn: Math.round(dailyBurn),
    forecast,
    futureSavings,
  };
}
