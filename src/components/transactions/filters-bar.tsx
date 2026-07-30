"use client";
import * as React from "react";
import { FilterX, Search } from "lucide-react";
import { CATEGORIES, type TransactionFilters } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  filters: TransactionFilters;
  merchants: string[];
  onChange: (f: TransactionFilters) => void;
  onReset: () => void;
}

export function FiltersBar({ filters, merchants, onChange, onReset }: Props) {
  const set = <K extends keyof TransactionFilters>(k: K, v: TransactionFilters[K]) =>
    onChange({ ...filters, [k]: v });

  return (
    <div className="glass grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="relative xl:col-span-2">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.query}
          onChange={(e) => set("query", e.target.value)}
          placeholder="Search description, merchant, category…"
          className="pl-9"
          aria-label="Search transactions"
        />
      </div>

      <Select value={filters.category} onValueChange={(v) => set("category", v as TransactionFilters["category"])}>
        <SelectTrigger aria-label="Category filter"><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.type} onValueChange={(v) => set("type", v as TransactionFilters["type"])}>
        <SelectTrigger aria-label="Type filter"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Income & expense</SelectItem>
          <SelectItem value="credit">Income only</SelectItem>
          <SelectItem value="debit">Expense only</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.merchant} onValueChange={(v) => set("merchant", v)}>
        <SelectTrigger aria-label="Merchant filter"><SelectValue placeholder="Merchant" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All merchants</SelectItem>
          {merchants.slice(0, 60).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Input type="date" value={filters.dateFrom ?? ""} onChange={(e) => set("dateFrom", e.target.value || null)} aria-label="From date" />
        <span className="text-xs text-muted-foreground">→</span>
        <Input type="date" value={filters.dateTo ?? ""} onChange={(e) => set("dateTo", e.target.value || null)} aria-label="To date" />
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number" min={0} placeholder="Min $" aria-label="Minimum amount"
          value={filters.amountMin ?? ""}
          onChange={(e) => set("amountMin", e.target.value === "" ? null : Number(e.target.value))}
        />
        <span className="text-xs text-muted-foreground">→</span>
        <Input
          type="number" min={0} placeholder="Max $" aria-label="Maximum amount"
          value={filters.amountMax ?? ""}
          onChange={(e) => set("amountMax", e.target.value === "" ? null : Number(e.target.value))}
        />
      </div>

      <Button variant="ghost" onClick={onReset} className="justify-self-start text-muted-foreground">
        <FilterX className="h-4 w-4" /> Reset filters
      </Button>
    </div>
  );
}
