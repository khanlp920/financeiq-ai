"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { CATEGORIES, type Budget, type Category } from "@/lib/types";
import { useFinance } from "@/hooks/use-finance-store";
import { uid } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: Budget | null;
}

export function BudgetDialog({ open, onOpenChange, editing }: Props) {
  const { saveBudget, budgets } = useFinance();
  const [category, setCategory] = React.useState<Category>("Food");
  const [limit, setLimit] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setCategory(editing?.category ?? "Food");
      setLimit(editing ? String(editing.limitAmount) : "");
      setError(null);
    }
  }, [open, editing]);

  async function submit() {
    const amount = Number(limit);
    if (!Number.isFinite(amount) || amount <= 0) { setError("Enter a positive monthly limit."); return; }
    if (!editing && budgets.some((b) => b.category === category)) {
      setError(`A budget for ${category} already exists — edit it instead.`);
      return;
    }
    setBusy(true);
    await saveBudget({
      id: editing?.id ?? uid(),
      category,
      month: editing?.month ?? new Date().toISOString().slice(0, 7),
      limitAmount: Math.round(amount * 100) / 100,
    });
    setBusy(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit budget" : "New budget"}</DialogTitle>
          <DialogDescription>Set a monthly spending limit for one category.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)} disabled={!!editing}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.filter((c) => c !== "Salary" && c !== "Cash Deposit").map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="limit">Monthly limit ($)</Label>
            <Input id="limit" type="number" min={1} step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="500" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Create budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
