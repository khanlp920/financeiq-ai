"use client";
import * as React from "react";
import { FileDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useFinance } from "@/hooks/use-finance-store";
import { exportCsv, exportPdfReport, exportXlsx } from "@/lib/export";
import { computeKpis, monthlyAggregates } from "@/lib/finance";
import { fmtCompact } from "@/lib/utils";
import { Topbar } from "@/components/layout/topbar";
import { EmptyState, PageSkeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const REPORTS = [
  {
    key: "pdf" as const,
    icon: FileText,
    title: "Full PDF report",
    body: "Executive summary, income & expense analysis, cash flow, category charts, top merchants and AI recommendations — styled for sharing.",
    action: "Download PDF",
  },
  {
    key: "xlsx" as const,
    icon: FileSpreadsheet,
    title: "Excel workbook",
    body: "Two sheets: every transaction with categories, plus a monthly income / expense / net summary for pivot tables.",
    action: "Download XLSX",
  },
  {
    key: "csv" as const,
    icon: FileDown,
    title: "Raw CSV export",
    body: "All parsed columns — date, description, amounts, balance, bank, category, merchant — for any external tool.",
    action: "Download CSV",
  },
];

export default function ReportsPage() {
  const { transactions, loading } = useFinance();
  const [busy, setBusy] = React.useState<string | null>(null);
  const kpi = React.useMemo(() => computeKpis(transactions), [transactions]);
  const months = React.useMemo(() => monthlyAggregates(transactions), [transactions]);

  async function run(key: "pdf" | "xlsx" | "csv") {
    setBusy(key);
    try {
      // Yield a frame so the spinner paints before heavy work.
      await new Promise((r) => setTimeout(r, 30));
      if (key === "pdf") exportPdfReport(transactions);
      if (key === "xlsx") exportXlsx(transactions);
      if (key === "csv") exportCsv(transactions);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Topbar title="Reports" />
      <main className="mx-auto max-w-4xl space-y-6 p-4 pb-24 sm:p-6 lg:pb-8">
        {loading ? (
          <PageSkeleton />
        ) : !transactions.length ? (
          <EmptyState
            icon={FileText}
            title="No data to report on"
            body="Upload a statement and generate polished PDF, Excel and CSV reports in one click."
            actionHref="/upload"
            actionLabel="Upload a statement"
          />
        ) : (
          <>
            <div className="glass flex flex-wrap items-center gap-x-8 gap-y-2 p-4 text-sm">
              <span className="text-muted-foreground">Covering</span>
              <span className="font-medium">{months.length} months · {transactions.length.toLocaleString()} transactions</span>
              <span className="text-muted-foreground">Income {fmtCompact(kpi.totalIncome)} · Expense {fmtCompact(kpi.totalExpense)} · Net {fmtCompact(kpi.netSavings)}</span>
            </div>
            <section className="grid gap-4 md:grid-cols-3">
              {REPORTS.map((r) => (
                <Card key={r.key} className="flex flex-col p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/12 text-primary">
                    <r.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg">{r.title}</h3>
                  <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{r.body}</p>
                  <Button className="mt-4" variant={r.key === "pdf" ? "default" : "outline"}
                    disabled={busy !== null} onClick={() => run(r.key)}>
                    {busy === r.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <r.icon className="h-4 w-4" />}
                    {r.action}
                  </Button>
                </Card>
              ))}
            </section>
          </>
        )}
      </main>
    </>
  );
}
