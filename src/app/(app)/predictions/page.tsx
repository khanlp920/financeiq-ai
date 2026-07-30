"use client";
import * as React from "react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { CalendarRange, LineChart as LineChartIcon, Wallet2 } from "lucide-react";
import { predict } from "@/lib/predictions";
import { computeKpis } from "@/lib/finance";
import { useFinance } from "@/hooks/use-finance-store";
import { fmtCompact, fmtMoney } from "@/lib/utils";
import { Topbar } from "@/components/layout/topbar";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartCard, EmptyState, PageSkeleton } from "@/components/shared";

const axis = { stroke: "hsl(var(--muted-foreground) / .5)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle: React.CSSProperties = {
  background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))",
  borderRadius: 12, fontSize: 12, color: "hsl(var(--popover-foreground))",
};

export default function PredictionsPage() {
  const { transactions, loading } = useFinance();
  const p = React.useMemo(() => predict(transactions), [transactions]);
  const kpi = React.useMemo(() => computeKpis(transactions), [transactions]);
  const savingsSeries = React.useMemo(() => {
    if (!p) return [];
    let cum = 0;
    return p.futureSavings.map((m) => { cum += m.projectedSavings; return { label: m.label, cumulative: Math.round(cum) }; });
  }, [p]);
  const sixMonthSavings = savingsSeries.at(-1)?.cumulative ?? 0;

  return (
    <>
      <Topbar title="Predictions" />
      <main className="space-y-6 p-4 pb-24 sm:p-6 lg:pb-8">
        {loading ? (
          <PageSkeleton />
        ) : !transactions.length || !p ? (
          <EmptyState
            icon={LineChartIcon}
            title="Not enough data to forecast"
            body="Upload at least one month of transactions and the model will project balances, spending and savings."
            actionHref="/upload"
            actionLabel="Upload a statement"
          />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <KpiCard index={0} label="Predicted EOM Balance" value={fmtCompact(p.endOfMonthBalance)} icon={Wallet2}
                tone={p.endOfMonthBalance >= kpi.currentBalance ? "good" : "warn"}
                sub={`Now ${fmtCompact(kpi.currentBalance)}`} />
              <KpiCard index={1} label="Expected Spend (This Month)" value={fmtCompact(p.expectedMonthSpend)} icon={CalendarRange}
                sub={`${fmtCompact(p.spendToDate)} spent so far`} />
              <KpiCard index={2} label="Daily Burn (Trailing)" value={fmtMoney(p.dailyBurn, true)} icon={LineChartIcon}
                sub="Average expense per day" />
              <KpiCard index={3} label="6-Month Savings Outlook" value={fmtCompact(sixMonthSavings)} icon={Wallet2}
                tone={sixMonthSavings >= 0 ? "good" : "bad"} sub="Linear trend projection" />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <ChartCard index={0} title="Cash-Flow Forecast" sub="Projected balance to month end, with confidence band">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={p.forecast}>
                    <defs>
                      <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" {...axis} tickFormatter={(d: string) => d.slice(8)} />
                    <YAxis {...axis} tickFormatter={(v: number) => fmtCompact(v)} width={56} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(Number(v))} />
                    <Area type="monotone" dataKey="high" name="Optimistic" stroke="transparent" fill="url(#bandFill)" />
                    <Area type="monotone" dataKey="low" name="Pessimistic" stroke="transparent" fill="hsl(var(--background))" fillOpacity={1} />
                    <Line type="monotone" dataKey="projectedBalance" name="Projected balance" stroke="hsl(var(--chart-2))" strokeWidth={2.5} dot={false} strokeDasharray="6 3" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard index={1} title="Future Savings Projection" sub="Cumulative net savings, next 6 months">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={savingsSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" {...axis} />
                    <YAxis {...axis} tickFormatter={(v: number) => fmtCompact(v)} width={56} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(Number(v))} />
                    <Line type="monotone" dataKey="cumulative" name="Cumulative savings" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </section>

            <p className="text-xs text-muted-foreground">
              Forecasts blend your month-to-date pace with trailing three-month averages; the shaded band widens with
              day-to-day volatility (±1σ·√days). Projections are estimates, not financial advice.
            </p>
          </>
        )}
      </main>
    </>
  );
}
