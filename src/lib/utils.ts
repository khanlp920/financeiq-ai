import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { currencySymbol } from "@/lib/currency";

const grouped = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const groupedCents = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtMoney(n: number, cents = false): string {
  if (!Number.isFinite(n)) return `${currencySymbol()}0`;
  const sign = n < 0 ? "−" : "";
  return `${sign}${currencySymbol()}${(cents ? groupedCents : grouped).format(Math.abs(n))}`;
}

/** Compact: ৳12.4k, ৳1.2M, ৳3.4B */
export function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return `${currencySymbol()}0`;
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const sym = currencySymbol();
  if (abs >= 1_000_000_000) return `${sign}${sym}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}${sym}${(abs / 1_000).toFixed(1)}k`;
  return fmtMoney(n);
}

export function fmtPct(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "0%";
  // Display guard: keep extreme ratios readable (corrupt/partial data can
  // produce astronomical percentages that wreck the layout).
  const clamped = Math.max(-99.99, Math.min(99.99, n));
  const prefix = clamped !== n ? (n > 0 ? ">" : "<") : "";
  return `${prefix}${(clamped * 100).toFixed(digits)}%`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
