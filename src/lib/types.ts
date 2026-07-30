/** Core domain types shared across the app (client + server). */

export const CATEGORIES = [
  "Salary", "Food", "Grocery", "Fuel", "Shopping", "Healthcare",
  "Entertainment", "Investment", "Utilities", "Rent", "EMI", "Insurance",
  "Travel", "Education", "Transfer", "ATM Withdrawal", "Cash Deposit", "Others",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type TransactionType = "debit" | "credit";

export interface Transaction {
  id: string;
  /** ISO date, e.g. "2026-03-14" */
  date: string;
  description: string;
  /** Signed amount: positive = credit (money in), negative = debit (money out). */
  amount: number;
  debit: number;
  credit: number;
  /** Running balance if the statement provides one. */
  balance: number | null;
  accountNumber: string | null;
  bankName: string | null;
  category: Category;
  merchant: string;
  type: TransactionType;
  /** id of the statement/upload this row came from */
  statementId: string | null;
}

export interface StatementFile {
  id: string;
  fileName: string;
  fileType: "pdf" | "csv" | "xlsx";
  uploadedAt: string;
  rowCount: number;
  bankName: string | null;
}

export interface Budget {
  id: string;
  category: Category;
  /** "2026-07" */
  month: string;
  limitAmount: number;
}

export interface KpiSummary {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRate: number;       // 0..1
  currentBalance: number;
  monthlyBurnRate: number;   // avg expense / month
}

export interface MonthlyAggregate {
  month: string;             // "2026-07"
  label: string;             // "Jul 26"
  income: number;
  expense: number;
  net: number;
  endBalance: number | null;
}

export interface CategoryAggregate {
  category: Category;
  total: number;
  count: number;
  share: number;             // 0..1 of total expense
}

export interface MerchantAggregate {
  merchant: string;
  total: number;
  count: number;
  category: Category;
}

export interface Insight {
  id: string;
  kind:
    | "highlight" | "anomaly" | "subscription" | "duplicate"
    | "opportunity" | "comparison" | "health";
  severity: "info" | "good" | "warn" | "bad";
  title: string;
  body: string;
  value?: string;
}

export interface Prediction {
  endOfMonthBalance: number;
  expectedMonthSpend: number;
  spendToDate: number;
  dailyBurn: number;
  forecast: { date: string; projectedBalance: number; low: number; high: number }[];
  futureSavings: { month: string; label: string; projectedSavings: number }[];
}

export interface HealthScore {
  score: number;             // 0..100
  grade: "A" | "B" | "C" | "D" | "F";
  components: { label: string; score: number; weight: number; detail: string }[];
}

export interface TransactionFilters {
  query: string;
  category: Category | "all";
  type: TransactionType | "all";
  merchant: string | "all";
  dateFrom: string | null;
  dateTo: string | null;
  amountMin: number | null;
  amountMax: number | null;
}

export const EMPTY_FILTERS: TransactionFilters = {
  query: "", category: "all", type: "all", merchant: "all",
  dateFrom: null, dateTo: null, amountMin: null, amountMax: null,
};
