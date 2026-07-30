"use client";
import * as React from "react";
import { Banknote, CloudOff, Database, RefreshCcw, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinance } from "@/hooks/use-finance-store";
import { supabaseConfigured } from "@/lib/supabase/client";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export default function SettingsPage() {
  const { user, demoMode, transactions, statements, resetToDemo, clearAll, currency, setCurrency } = useFinance();
  const [confirmClear, setConfirmClear] = React.useState(false);
  const configured = supabaseConfigured();

  return (
    <>
      <Topbar title="Settings" />
      <main className="mx-auto max-w-2xl space-y-5 p-4 pb-24 sm:p-6 lg:pb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4" /> Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Signed in as</span>
              <span className="font-medium">{user?.email ?? "Guest (local session)"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan</span>
              <Badge variant="secondary">Free</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cloud sync</span>
              {configured && user ? (
                <span className="inline-flex items-center gap-1.5 text-success"><ShieldCheck className="h-4 w-4" /> Active (Supabase RLS)</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground"><CloudOff className="h-4 w-4" /> {configured ? "Sign in to enable" : "Not configured"}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Banknote className="h-4 w-4" /> Currency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Display currency</span>
              <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                <SelectTrigger className="w-52" aria-label="Display currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CURRENCIES).map(([code, c]) => (
                    <SelectItem key={code} value={code}>{c.symbol} {code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Auto-detected from uploaded statements; change it here if needed. Amounts are displayed
              as-is — no exchange-rate conversion is applied.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" /> Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stored transactions</span>
              <span className="tnum font-medium">{transactions.length.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Uploaded statements</span>
              <span className="tnum font-medium">{statements.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Mode</span>
              {demoMode ? <Badge variant="warning">Demo dataset</Badge> : <Badge>Your data</Badge>}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={resetToDemo}>
                <RefreshCcw className="h-4 w-4" /> Reset to demo data
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirmClear(true)}>
                <Trash2 className="h-4 w-4" /> Clear all data
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          FinanceIQ AI provides analytics, not financial advice. Categorization is automated and may occasionally
          misfile a transaction.
        </p>
      </main>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear all data?</DialogTitle>
            <DialogDescription>
              This removes every transaction, statement and budget from this device
              {user ? " and your cloud account" : ""}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => { await clearAll(); setConfirmClear(false); }}>
              Yes, delete everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
