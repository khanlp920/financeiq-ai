"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, PencilLine, PiggyBank, Plus, Trash2, TrendingUp } from "lucide-react";
import { useFinance } from "@/hooks/use-finance-store";
import { monthKey, fmtMoney, fmtPct, clamp } from "@/lib/utils";
import { Topbar } from "@/components/layout/topbar";
import { BudgetDialog } from "@/components/budgets/budget-dialog";
import { EmptyState, PageSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Budget } from "@/lib/types";

export default function BudgetsPage() {
  const { transactions, budgets, deleteBudget, loading, applyDefaultBudgets } = useFinance();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Budget | null>(null);

  const now = new Date();
  const currentKey = monthKey(now.toISOString().slice(0, 10));
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const rows = React.useMemo(() => {
    return budgets
      .map((b) => {
        const spent = transactions
          .filter((t) => t.category === b.category && t.debit > 0 && monthKey(t.date) === currentKey)
          .reduce((s, t) => s + t.debit, 0);
        const pct = spent / b.limitAmount;
        // Straight-line forecast to end of month based on current pace.
        const forecast = dayOfMonth > 0 ? (spent / dayOfMonth) * daysInMonth : spent;
        return { budget: b, spent, pct, forecast };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [budgets, transactions, currentKey, dayOfMonth, daysInMonth]);

  const over = rows.filter((r) => r.pct >= 1).length;
  const risky = rows.filter((r) => r.pct < 1 && r.forecast > r.budget.limitAmount).length;

  return (
    <>
      <Topbar title="Budgets" />
      <main className="space-y-5 p-4 pb-24 sm:p-6 lg:pb-8">
        {loading ? (
          <PageSkeleton />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                {over > 0 && <Badge variant="destructive">{over} over budget</Badge>}
                {risky > 0 && <Badge variant="warning">{risky} trending over</Badge>}
              </div>
              <div className="flex gap-2">
                {!budgets.length && (
                  <Button variant="outline" onClick={applyDefaultBudgets}>Suggest budgets</Button>
                )}
                <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4" /> New budget
                </Button>
              </div>
            </div>

            {!budgets.length ? (
              <EmptyState
                icon={PiggyBank}
                title="No budgets yet"
                body="Create category limits, or let FinanceIQ suggest budgets from your last three months of spending."
              />
            ) : (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rows.map(({ budget, spent, pct, forecast }, i) => {
                  const overBudget = pct >= 1;
                  const trendingOver = !overBudget && forecast > budget.limitAmount;
                  return (
                    <motion.div
                      key={budget.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.4 }}
                    >
                      <Card className="group p-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{budget.category}</p>
                            <p className="tnum mt-0.5 text-sm text-muted-foreground">
                              {fmtMoney(spent, true)} of {fmtMoney(budget.limitAmount, true)}
                            </p>
                          </div>
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button variant="ghost" size="icon" aria-label={`Edit ${budget.category} budget`}
                              onClick={() => { setEditing(budget); setDialogOpen(true); }}>
                              <PencilLine className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label={`Delete ${budget.category} budget`}
                              onClick={() => deleteBudget(budget.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <Progress
                          value={clamp(pct * 100, 0, 100)}
                          className="mt-4 h-2"
                          indicatorClassName={overBudget ? "bg-destructive" : trendingOver ? "bg-warning" : undefined}
                        />
                        <div className="mt-2.5 flex items-center justify-between text-xs">
                          <span className={overBudget ? "font-medium text-destructive" : trendingOver ? "font-medium text-warning" : "text-muted-foreground"}>
                            {overBudget ? (
                              <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Over by {fmtMoney(spent - budget.limitAmount, true)}</span>
                            ) : trendingOver ? (
                              <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Pacing to {fmtMoney(forecast, true)}</span>
                            ) : (
                              `${fmtMoney(budget.limitAmount - spent, true)} left`
                            )}
                          </span>
                          <span className="tnum text-muted-foreground">{fmtPct(pct, 0)}</span>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </section>
            )}
          </>
        )}
      </main>
      <BudgetDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </>
  );
}
