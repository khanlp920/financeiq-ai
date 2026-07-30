"use client";
import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, fmtDate, fmtMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Transaction } from "@/lib/types";

const PAGE_SIZE = 50;

/** Paginated transaction table. Rows are cheap (memoized), pages capped at 50. */
export function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const [page, setPage] = React.useState(0);
  const pages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));

  React.useEffect(() => { setPage(0); }, [transactions]);

  const slice = React.useMemo(
    () => transactions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [transactions, page]
  );

  return (
    <div className="glass overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Date</TableHead>
            <TableHead>Merchant / Description</TableHead>
            <TableHead className="hidden md:table-cell">Category</TableHead>
            <TableHead className="hidden lg:table-cell">Bank</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slice.map((t) => <Row key={t.id} t={t} />)}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm text-muted-foreground">
        <span>
          {transactions.length.toLocaleString()} transactions · page {page + 1} of {pages}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

const Row = React.memo(function Row({ t }: { t: Transaction }) {
  const credit = t.type === "credit";
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(t.date)}</TableCell>
      <TableCell className="max-w-[280px]">
        <div className="flex items-center gap-2.5">
          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", credit ? "bg-success/12 text-success" : "bg-muted text-muted-foreground")}>
            {credit ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{t.merchant}</p>
            <p className="truncate text-xs text-muted-foreground">{t.description}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell"><Badge variant="secondary">{t.category}</Badge></TableCell>
      <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">{t.bankName ?? "—"}</TableCell>
      <TableCell className={cn("tnum whitespace-nowrap text-right font-medium", credit ? "text-success" : "")}>
        {credit ? "+" : "−"}{fmtMoney(Math.abs(t.amount), true)}
      </TableCell>
      <TableCell className="tnum hidden whitespace-nowrap text-right text-muted-foreground sm:table-cell">
        {t.balance != null ? fmtMoney(t.balance, true) : "—"}
      </TableCell>
    </TableRow>
  );
});
