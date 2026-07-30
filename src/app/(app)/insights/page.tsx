"use client";
import * as React from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, BadgeCheck, CalendarClock,
  Copy, Gauge, Lightbulb, Repeat, Sparkles,
} from "lucide-react";
import { generateInsights, detectRecurring, healthScore } from "@/lib/insights";
import { useFinance } from "@/hooks/use-finance-store";
import { fmtMoney } from "@/lib/utils";
import { Topbar } from "@/components/layout/topbar";
import { EmptyState, PageSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Insight } from "@/lib/types";

const ICONS: Record<Insight["kind"], React.ElementType> = {
  highlight: Sparkles,
  anomaly: AlertTriangle,
  duplicate: Copy,
  subscription: CalendarClock,
  opportunity: Lightbulb,
  comparison: ArrowUpRight,
  health: Gauge,
};

const TONES: Record<Insight["severity"], string> = {
  info: "bg-primary/12 text-primary",
  good: "bg-success/12 text-success",
  warn: "bg-warning/12 text-warning",
  bad: "bg-destructive/12 text-destructive",
};

const VERDICTS: Record<string, string> = {
  A: "Excellent — strong savings, steady spending and consistently positive months.",
  B: "Solid footing. A little more consistency or savings pushes you into the top tier.",
  C: "Decent, with clear room to improve — start with your largest spending category.",
  D: "Under strain. Recurring costs and low savings are eating your margin.",
  F: "At risk — spending regularly outpaces income. Time for a hard budget reset.",
};

export default function InsightsPage() {
  const { transactions, loading } = useFinance();
  const insights = React.useMemo(() => generateInsights(transactions), [transactions]);
  const recurring = React.useMemo(() => detectRecurring(transactions), [transactions]);
  const health = React.useMemo(() => healthScore(transactions), [transactions]);

  return (
    <>
      <Topbar title="AI Insights" />
      <main className="space-y-6 p-4 pb-24 sm:p-6 lg:pb-8">
        {loading ? (
          <PageSkeleton />
        ) : !transactions.length ? (
          <EmptyState
            icon={Sparkles}
            title="Insights need data"
            body="Upload a statement and the engine will surface anomalies, duplicates, subscriptions and savings opportunities."
            actionHref="/upload"
            actionLabel="Upload a statement"
          />
        ) : (
          <>
            {/* Health score hero */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
              <Card className="relative overflow-hidden p-6">
                <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
                <div className="flex flex-wrap items-center gap-6">
                  <div className="relative grid h-28 w-28 place-items-center">
                    <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="9" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke="hsl(var(--primary))" strokeWidth="9" strokeLinecap="round"
                        strokeDasharray={`${(health.score / 100) * 264} 264`}
                      />
                    </svg>
                    <div className="absolute text-center">
                      <p className="tnum font-display text-3xl">{health.score}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">/ 100</p>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-primary" />
                      <h2 className="font-display text-xl">Financial Health Score</h2>
                      <Badge>{health.grade}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{VERDICTS[health.grade]}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {health.components.map((f) => (
                        <div key={f.label}>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{f.label}</span>
                            <span className="tnum font-medium">{Math.round(f.score)}</span>
                          </div>
                          <Progress value={f.score} className="mt-1 h-1.5" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Insight cards */}
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {insights.map((ins, i) => {
                const Icon = ICONS[ins.kind] ?? Sparkles;
                return (
                  <motion.div
                    key={ins.id}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ delay: (i % 6) * 0.05, duration: 0.4 }}
                  >
                    <Card className="h-full p-5">
                      <div className="flex items-start gap-3">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${TONES[ins.severity]}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium leading-snug">{ins.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{ins.body}</p>
                          {ins.value && (
                            <p className="tnum mt-2 font-display text-lg">{ins.value}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </section>

            {/* Recurring & subscriptions */}
            {recurring.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Repeat className="h-4 w-4" /> Recurring payments & subscriptions
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Same merchant, similar amount, three or more months in a row.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {recurring.map((r) => (
                    <div key={r.merchant} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.merchant}</p>
                        <p className="text-xs text-muted-foreground">{r.months} months · {r.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="tnum text-sm font-medium">{fmtMoney(r.amount, true)}</p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">/ month</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BadgeCheck className="h-3.5 w-3.5 text-primary" />
              Insights are computed locally from your parsed transactions — nothing is sent anywhere.
              <ArrowDownRight className="h-3 w-3" />
            </div>
          </>
        )}
      </main>
    </>
  );
}
