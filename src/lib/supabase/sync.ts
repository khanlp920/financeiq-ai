"use client";

/**
 * Persistence adapter. When Supabase is configured and a user is signed in,
 * mirrors transactions/budgets/statements to Postgres (RLS-scoped per user).
 * Otherwise, everything lives in localStorage (Demo Mode) so the entire app
 * is usable with zero setup.
 */
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { Budget, StatementFile, Transaction } from "@/lib/types";

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export async function pushTransactions(userId: string, txns: Transaction[]): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  const rows = txns.map((t) => ({
    id: t.id, user_id: userId, date: t.date, description: t.description,
    amount: t.amount, debit: t.debit, credit: t.credit, balance: t.balance,
    account_number: t.accountNumber, bank_name: t.bankName, category: t.category,
    merchant: t.merchant, type: t.type, statement_id: t.statementId,
  }));
  for (const batch of chunk(rows, 500)) {
    const { error } = await sb.from("transactions").upsert(batch);
    if (error) throw new Error(`Supabase sync failed: ${error.message}`);
  }
}

export async function pullTransactions(userId: string): Promise<Transaction[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return [];
  const all: Transaction[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb
      .from("transactions").select("*").eq("user_id", userId)
      .order("date", { ascending: false }).range(from, from + page - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const r of data) {
      all.push({
        id: r.id, date: r.date, description: r.description, amount: Number(r.amount),
        debit: Number(r.debit), credit: Number(r.credit),
        balance: r.balance == null ? null : Number(r.balance),
        accountNumber: r.account_number, bankName: r.bank_name, category: r.category,
        merchant: r.merchant, type: r.type, statementId: r.statement_id,
      });
    }
    if (data.length < page) break;
  }
  return all;
}

export async function pushBudget(userId: string, b: Budget): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  const { error } = await sb.from("budgets").upsert({
    id: b.id, user_id: userId, category: b.category, month: b.month, limit_amount: b.limitAmount,
  });
  if (error) throw new Error(error.message);
}

export async function deleteBudgetRemote(id: string): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  await sb.from("budgets").delete().eq("id", id);
}

export async function pullBudgets(userId: string): Promise<Budget[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return [];
  const { data, error } = await sb.from("budgets").select("*").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id, category: r.category, month: r.month, limitAmount: Number(r.limit_amount),
  }));
}

export async function pushStatement(userId: string, s: StatementFile, file?: File): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  const { error } = await sb.from("statements").upsert({
    id: s.id, user_id: userId, file_name: s.fileName, file_type: s.fileType,
    uploaded_at: s.uploadedAt, row_count: s.rowCount, bank_name: s.bankName,
  });
  if (error) throw new Error(error.message);
  if (file) {
    // Original file kept in private, RLS-protected bucket
    await sb.storage.from("statements").upload(`${userId}/${s.id}-${s.fileName}`, file, { upsert: true });
  }
}
