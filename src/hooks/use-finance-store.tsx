"use client";

/**
 * Global finance store (React context).
 *
 * Data source priority:
 *   1. Supabase (configured + signed in)  → cloud persistence, RLS-scoped
 *   2. localStorage                        → uploads persist locally
 *   3. Demo dataset                        → instant, zero-setup experience
 */
import * as React from "react";
import type { User } from "@supabase/supabase-js";
import { generateDemoTransactions } from "@/lib/demo-data";
import { getSupabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";
import {
  deleteBudgetRemote, pullBudgets, pullTransactions,
  pushBudget, pushStatement, pushTransactions,
} from "@/lib/supabase/sync";
import type { Budget, StatementFile, Transaction } from "@/lib/types";

const LS_TXNS = "fiq.transactions.v1";
const LS_BUDGETS = "fiq.budgets.v1";
const LS_STMTS = "fiq.statements.v1";

interface FinanceStore {
  loading: boolean;
  demoMode: boolean;
  user: User | null;
  authReady: boolean;
  transactions: Transaction[];
  budgets: Budget[];
  statements: StatementFile[];
  addTransactions: (txns: Transaction[], statement: StatementFile, file?: File) => Promise<void>;
  saveBudget: (b: Budget) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  resetToDemo: () => void;
  clearAll: () => void;
  signOut: () => Promise<void>;
  applyDefaultBudgets: () => void;
}

const Ctx = React.createContext<FinanceStore | null>(null);

function readLS<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeLS(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState<User | null>(null);
  const [authReady, setAuthReady] = React.useState(!supabaseConfigured());
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [budgets, setBudgets] = React.useState<Budget[]>([]);
  const [statements, setStatements] = React.useState<StatementFile[]>([]);
  const [demoMode, setDemoMode] = React.useState(false);

  // Track auth state
  React.useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => { setUser(data.user ?? null); setAuthReady(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load data whenever auth state settles
  React.useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (user) {
          const [txns, buds] = await Promise.all([pullTransactions(user.id), pullBudgets(user.id)]);
          if (cancelled) return;
          if (txns.length) {
            setTransactions(txns); setBudgets(buds); setDemoMode(false);
          } else {
            setTransactions(generateDemoTransactions()); setBudgets(buds); setDemoMode(true);
          }
        } else {
          const local = readLS<Transaction[]>(LS_TXNS);
          if (local?.length) {
            setTransactions(local);
            setBudgets(readLS<Budget[]>(LS_BUDGETS) ?? []);
            setStatements(readLS<StatementFile[]>(LS_STMTS) ?? []);
            setDemoMode(false);
          } else {
            setTransactions(generateDemoTransactions());
            setBudgets(readLS<Budget[]>(LS_BUDGETS) ?? defaultBudgets());
            setDemoMode(true);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authReady, user]);

  const addTransactions = React.useCallback(
    async (txns: Transaction[], statement: StatementFile, file?: File) => {
      setTransactions((prev) => {
        // de-dupe on (date, description, amount) against existing rows
        const seen = new Set(prev.map((t) => `${t.date}|${t.description}|${t.amount.toFixed(2)}`));
        const fresh = txns.filter((t) => !seen.has(`${t.date}|${t.description}|${t.amount.toFixed(2)}`));
        const base = demoMode ? [] : prev; // first real upload replaces demo data
        const next = [...base, ...fresh];
        if (!user) writeLS(LS_TXNS, next);
        return next;
      });
      setStatements((prev) => {
        const next = [...prev, statement];
        if (!user) writeLS(LS_STMTS, next);
        return next;
      });
      setDemoMode(false);
      if (user) {
        await pushStatement(user.id, statement, file);
        await pushTransactions(user.id, txns);
      }
    },
    [user, demoMode]
  );

  const saveBudget = React.useCallback(async (b: Budget) => {
    setBudgets((prev) => {
      const next = [...prev.filter((x) => x.id !== b.id), b];
      writeLS(LS_BUDGETS, next);
      return next;
    });
    if (user) await pushBudget(user.id, b);
  }, [user]);

  const deleteBudget = React.useCallback(async (id: string) => {
    setBudgets((prev) => {
      const next = prev.filter((x) => x.id !== id);
      writeLS(LS_BUDGETS, next);
      return next;
    });
    if (user) await deleteBudgetRemote(id);
  }, [user]);

  const resetToDemo = React.useCallback(() => {
    window.localStorage.removeItem(LS_TXNS);
    window.localStorage.removeItem(LS_STMTS);
    setTransactions(generateDemoTransactions());
    setStatements([]);
    setDemoMode(true);
  }, []);

  const clearAll = React.useCallback(() => {
    window.localStorage.removeItem(LS_TXNS);
    window.localStorage.removeItem(LS_BUDGETS);
    window.localStorage.removeItem(LS_STMTS);
    setTransactions([]); setBudgets([]); setStatements([]); setDemoMode(false);
  }, []);

  const applyDefaultBudgets = React.useCallback(() => {
    const next = defaultBudgets();
    setBudgets(next);
    writeLS(LS_BUDGETS, next);
  }, []);

  const signOut = React.useCallback(async () => {
    const sb = getSupabaseBrowser();
    if (sb) await sb.auth.signOut();
  }, []);

  const value = React.useMemo<FinanceStore>(() => ({
    loading, demoMode, user, authReady, transactions, budgets, statements,
    addTransactions, saveBudget, deleteBudget, resetToDemo, clearAll, signOut, applyDefaultBudgets,
  }), [loading, demoMode, user, authReady, transactions, budgets, statements,
       addTransactions, saveBudget, deleteBudget, resetToDemo, clearAll, signOut, applyDefaultBudgets]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFinance(): FinanceStore {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useFinance must be used inside <FinanceProvider>");
  return ctx;
}

function defaultBudgets(): Budget[] {
  const month = new Date().toISOString().slice(0, 7);
  return [
    { id: "b-food", category: "Food", month, limitAmount: 700 },
    { id: "b-grocery", category: "Grocery", month, limitAmount: 900 },
    { id: "b-shopping", category: "Shopping", month, limitAmount: 500 },
    { id: "b-entertainment", category: "Entertainment", month, limitAmount: 200 },
  ];
}
