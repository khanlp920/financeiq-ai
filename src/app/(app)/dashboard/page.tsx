"use client";
import * as React from "react";
import {
  Activity, Flame, PiggyBank, TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import {
  balanceHistory, categoryAggregates, computeKpis, dailySpend,
  merchantAggregates, monthlyAggregates, spendingTrend,
} from "@/lib/finance";
import { useFinance } from "@/hooks/use-finance-store";
import { fmtCompact, fmtMoney, fmtPct } from "@/lib/utils";
import {
  BalanceChart, CashFlowChart, CategoryDonut, IncomeExpenseChart,
  IncomeTrendChart, SpendingTrendChart, TopMerchantsChart,
} from "@/components/dashboard/charts";
import { SpendingHeatmap } from "@/components/dashboard/heatmap";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Topbar } from "@/components/layout/topbar";
import { ChartCard, EmptyState, PageSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { transactions, loading } = useFinance();

  const kpi = React.useMemo(() => computeKpis(transactions), [transactions]);
  const months = React.useMemo(() => monthlyAggregates(transactions), [transactions]);
  const cats = React.useMemo(() => categoryAggregates(transactions), [transactions]);
  const merchants = React.useMemo(() => merchantAggregates(transactions, 8), [transactions]);
  const balances = React.useMemo(() => balanceHistory(transactions), [transactions]);
  const trend = React.useMemo(() => spendingTrend(transactions).slice(-120), [transactions]);
  const daily = React.useMemo(() => dailySpend(transactions), [transactions]);

  return (
    <>
      <Topbar title="Dashboard" />
      <main className="space-y-6 p-4 pb-24 sm:p-6 lg:pb-8">
        {loading ? (
          <PageSkeleton />
        ) : !transactions.length ? (
          <EmptyState
            title="No transactions yet"
            body="Upload a bank statement (PDF, CSV or Excel) and your dashboard will light up with insights."
            actionHref="/upload"
            actionLabel="Upload a statement"
          />
        ) : (
          <>
            {/* KPI row */}
            <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              <KpiCard index={0} label="Total Income" value={fmtCompact(kpi.totalIncome)} icon={TrendingUp} tone="good" sub={`${months.length} months`} />
              <KpiCard index={1} label="Total Expense" value={fmtCompact(kpi.totalExpense)} icon={TrendingDown} tone="bad" sub={`${transactions.filter((t) => t.debit > 0).length.toLocaleString()} debits`} />
              <KpiCard index={2} label="Net Savings" value={fmtCompact(kpi.netSavings)} icon={PiggyBank} tone={kpi.netSavings >= 0 ? "good" : "bad"} sub="Income − expenses" />
              <KpiCard index={3} label="Savings Rate" value={fmtPct(kpi.savingsRate, 1)} icon={Activity} tone={kpi.savingsRate >= 0.2 ? "good" : "warn"} sub="Target ≥ 20%" />
              <KpiCard index={4} label="Current Balance" value={fmtCompact(kpi.currentBalance)} icon={Wallet} sub="Latest statement balance" />
              <KpiCard index={5} label="Monthly Burn" value={fmtCompact(kpi.monthlyBurnRate)} icon={Flame} tone="warn" sub="Avg expense / month" />
            </section>

            {/* Charts */}
            <section className="grid gap-4 lg:grid-cols-2">
              <ChartCard index={0} title="Income vs Expense" sub="Monthly totals">
                <IncomeExpenseChart data={months} />
              </ChartCard>
              <ChartCard index={1} title="Category Breakdown" sub="Where the money goes">
                <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto]">
                  <CategoryDonut data={cats} />
                  <ul className="space-y-1.5 pr-2 text-sm">
                    {cats.slice(0, 6).map((c, i) => (
                      <li key={c.category} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: `hsl(var(--chart-${(i % 6) + 1}))` }} />
                        <span className="text-muted-foreground">{c.category}</span>
                        <span className="tnum ml-auto pl-4 font-medium">{fmtCompact(c.total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </ChartCard>
              <ChartCard index={2} title="Cash Flow Timeline" sub="Net in − out by month">
                <CashFlowChart data={months} />
              </ChartCard>
              <ChartCard index={3} title="Balance History" sub="Running account balance">
                <BalanceChart data={balances} />
              </ChartCard>
              <ChartCard index={4} title="Spending Trend" sub="Daily spend with 7-day average">
                <SpendingTrendChart data={trend} />
              </ChartCard>
              <ChartCard index={5} title="Income Trend" sub="Monthly inflows">
                <IncomeTrendChart data={months} />
              </ChartCard>
              <ChartCard index={6} title="Top Merchants" sub="Highest total spending">
                <TopMerchantsChart data={merchants} />
              </ChartCard>
              <ChartCard index={7} title="Daily Spending Heatmap" sub="Trailing 6 months — darker = heavier spending">
                <SpendingHeatmap daily={daily} />
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">Tip</Badge> Hover any square for the exact day’s spend.
                </div>
              </ChartCard>
            </section>
          </>
        )}
      </main>
    </>
  );
}
