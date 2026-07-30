"use client";
/**
 * Recharts wrappers, all theme-aware via CSS variables and memoized —
 * the dashboard re-renders cheaply as filters change.
 */
import * as React from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmtCompact, fmtMoney } from "@/lib/utils";
import type { CategoryAggregate, MerchantAggregate, MonthlyAggregate } from "@/lib/types";

const CHART_COLORS = [1, 2, 3, 4, 5, 6].map((i) => `hsl(var(--chart-${i}))`);

const tooltipStyle: React.CSSProperties = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 8px 30px -10px hsl(var(--shadow) / .4)",
};

const axis = {
  stroke: "hsl(var(--muted-foreground) / .5)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const money = (v: number) => fmtCompact(v);

/** Monthly Income vs Expense grouped bars */
export const IncomeExpenseChart = React.memo(function IncomeExpenseChart({ data }: { data: MonthlyAggregate[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barGap={3}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={money} width={52} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(Number(v))} cursor={{ fill: "hsl(var(--muted) / .5)" }} />
        <Bar dataKey="income" name="Income" fill="hsl(var(--chart-1))" radius={[5, 5, 0, 0]} maxBarSize={22} />
        <Bar dataKey="expense" name="Expense" fill="hsl(var(--chart-5))" radius={[5, 5, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
});

/** Category donut */
export const CategoryDonut = React.memo(function CategoryDonut({ data }: { data: CategoryAggregate[] }) {
  const top = data.slice(0, 7);
  const rest = data.slice(7).reduce((s, c) => s + c.total, 0);
  const rows = rest > 0 ? [...top, { category: "Other", total: rest, count: 0, share: 0 }] : top;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(Number(v))} />
        <Pie data={rows} dataKey="total" nameKey="category" innerRadius="58%" outerRadius="86%" paddingAngle={2} strokeWidth={0}>
          {rows.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
});

/** Cash flow (net per month) */
export const CashFlowChart = React.memo(function CashFlowChart({ data }: { data: MonthlyAggregate[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={money} width={52} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(Number(v))} cursor={{ fill: "hsl(var(--muted) / .5)" }} />
        <Bar dataKey="net" name="Net cash flow" radius={[5, 5, 0, 0]} maxBarSize={26}>
          {data.map((m, i) => (
            <Cell key={i} fill={m.net >= 0 ? "hsl(var(--chart-1))" : "hsl(var(--chart-5))"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

/** Balance history area */
export const BalanceChart = React.memo(function BalanceChart({ data }: { data: { date: string; balance: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="date" {...axis} tickFormatter={(d: string) => d.slice(5)} minTickGap={40} />
        <YAxis {...axis} tickFormatter={money} width={52} domain={["auto", "auto"]} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(Number(v))} />
        <Area type="monotone" dataKey="balance" name="Balance" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#balFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
});

/** Spending trend: daily bars + 7-day average line */
export const SpendingTrendChart = React.memo(function SpendingTrendChart({ data }: { data: { date: string; spend: number; avg7: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="date" {...axis} tickFormatter={(d: string) => d.slice(5)} minTickGap={40} />
        <YAxis {...axis} tickFormatter={money} width={52} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(Number(v))} />
        <Line type="monotone" dataKey="spend" name="Daily spend" stroke="hsl(var(--muted-foreground) / .35)" strokeWidth={1} dot={false} />
        <Line type="monotone" dataKey="avg7" name="7-day average" stroke="hsl(var(--chart-3))" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
});

/** Income trend line */
export const IncomeTrendChart = React.memo(function IncomeTrendChart({ data }: { data: MonthlyAggregate[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="incFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={money} width={52} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(Number(v))} />
        <Area type="monotone" dataKey="income" name="Income" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#incFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
});

/** Top merchants horizontal bars */
export const TopMerchantsChart = React.memo(function TopMerchantsChart({ data }: { data: MerchantAggregate[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" {...axis} tickFormatter={money} />
        <YAxis type="category" dataKey="merchant" {...axis} width={130} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(Number(v))} cursor={{ fill: "hsl(var(--muted) / .5)" }} />
        <Bar dataKey="total" name="Spent" fill="hsl(var(--chart-4))" radius={[0, 5, 5, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
});
