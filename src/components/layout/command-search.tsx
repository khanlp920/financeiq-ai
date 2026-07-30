"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { sortByDateDesc } from "@/lib/finance";
import { useFinance } from "@/hooks/use-finance-store";
import { fmtDate, fmtMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** Global ⌘K search across every transaction. */
export function CommandSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { transactions } = useFinance();
  const router = useRouter();
  const [q, setQ] = React.useState("");

  const results = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return sortByDateDesc(transactions)
      .filter((t) => `${t.description} ${t.merchant} ${t.category}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [q, transactions]);

  React.useEffect(() => { if (!open) setQ(""); }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20%] max-w-xl translate-y-0 gap-0 p-0">
        <DialogTitle className="sr-only">Search transactions</DialogTitle>
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by merchant, description, category…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {q && !results.length && (
            <p className="p-6 text-center text-sm text-muted-foreground">No transactions match “{q}”.</p>
          )}
          {!q && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Type to search {transactions.length.toLocaleString()} transactions.
            </p>
          )}
          {results.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                onOpenChange(false);
                router.push(`/transactions?q=${encodeURIComponent(q)}`);
              }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.merchant}</p>
                <p className="truncate text-xs text-muted-foreground">{t.description}</p>
              </div>
              <Badge variant="secondary">{t.category}</Badge>
              <div className="text-right">
                <p className={`tnum font-medium ${t.type === "credit" ? "text-success" : ""}`}>
                  {t.type === "credit" ? "+" : "−"}{fmtMoney(Math.abs(t.amount), true)}
                </p>
                <p className="text-xs text-muted-foreground">{fmtDate(t.date)}</p>
              </div>
            </button>
          ))}
          {results.length > 0 && (
            <button
              onClick={() => { onOpenChange(false); router.push(`/transactions?q=${encodeURIComponent(q)}`); }}
              className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:bg-accent"
            >
              View all matches in Transactions <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
