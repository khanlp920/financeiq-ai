"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, FileText, Receipt } from "lucide-react";
import { applyFilters, sortByDateDesc } from "@/lib/finance";
import { useFinance } from "@/hooks/use-finance-store";
import { exportCsv, exportPdfReport, exportXlsx } from "@/lib/export";
import { EMPTY_FILTERS, type TransactionFilters } from "@/lib/types";
import { uniqueMerchants } from "@/lib/finance";
import { Topbar } from "@/components/layout/topbar";
import { EmptyState, PageSkeleton } from "@/components/shared";
import { FiltersBar } from "@/components/transactions/filters-bar";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function TransactionsPage() {
  return (
    <React.Suspense fallback={<PageSkeleton />}>
      <TransactionsInner />
    </React.Suspense>
  );
}

function TransactionsInner() {
  const { transactions, loading } = useFinance();
  const params = useSearchParams();
  const [filters, setFilters] = React.useState<TransactionFilters>({
    ...EMPTY_FILTERS,
    query: params.get("q") ?? "",
  });

  const merchants = React.useMemo(() => uniqueMerchants(transactions), [transactions]);
  const filtered = React.useMemo(
    () => sortByDateDesc(applyFilters(transactions, filters)),
    [transactions, filters]
  );

  return (
    <>
      <Topbar title="Transactions" />
      <main className="space-y-4 p-4 pb-24 sm:p-6 lg:pb-8">
        {loading ? (
          <PageSkeleton />
        ) : !transactions.length ? (
          <EmptyState
            icon={Receipt}
            title="No transactions to show"
            body="Upload a statement and every parsed, categorized row will appear here with full search and filters."
            actionHref="/upload"
            actionLabel="Upload a statement"
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Search, filter and export every transaction.
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm"><Download className="h-4 w-4" /> Export</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportCsv(filtered)}>
                    <FileText /> CSV (filtered rows)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportXlsx(filtered)}>
                    <FileSpreadsheet /> Excel workbook
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportPdfReport(filtered)}>
                    <FileText /> PDF report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <FiltersBar
              filters={filters}
              merchants={merchants}
              onChange={setFilters}
              onReset={() => setFilters(EMPTY_FILTERS)}
            />
            {filtered.length ? (
              <TransactionsTable transactions={filtered} />
            ) : (
              <EmptyState
                icon={Receipt}
                title="Nothing matches these filters"
                body="Try widening the date range or clearing the category and amount filters."
              />
            )}
          </>
        )}
      </main>
    </>
  );
}
