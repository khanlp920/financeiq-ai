"use client";

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { categoryAggregates, computeKpis, merchantAggregates, monthlyAggregates } from "@/lib/finance";
import { generateInsights, healthScore } from "@/lib/insights";
import { fmtMoney, fmtPct } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

/** ── CSV ────────────────────────────────────────────────────────────────── */
export function exportCsv(txns: Transaction[], fileName = "financeiq-transactions.csv") {
  const header = ["Date", "Description", "Merchant", "Category", "Type", "Debit", "Credit", "Amount", "Balance", "Account", "Bank"];
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const t of txns) {
    lines.push([t.date, t.description, t.merchant, t.category, t.type, t.debit, t.credit, t.amount, t.balance ?? "", t.accountNumber ?? "", t.bankName ?? ""].map(escape).join(","));
  }
  download(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), fileName);
}

/** ── Excel ──────────────────────────────────────────────────────────────── */
export function exportXlsx(txns: Transaction[], fileName = "financeiq-transactions.xlsx") {
  const rows = txns.map((t) => ({
    Date: t.date, Description: t.description, Merchant: t.merchant, Category: t.category,
    Type: t.type, Debit: t.debit, Credit: t.credit, Amount: t.amount,
    Balance: t.balance ?? "", Account: t.accountNumber ?? "", Bank: t.bankName ?? "",
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Transactions");
  const monthly = monthlyAggregates(txns).map((m) => ({
    Month: m.month, Income: m.income, Expense: m.expense, Net: m.net, "End Balance": m.endBalance ?? "",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthly), "Monthly Summary");
  XLSX.writeFile(wb, fileName);
}

/** ── PDF report ─────────────────────────────────────────────────────────── */
export function exportPdfReport(txns: Transaction[], fileName = "financeiq-report.pdf") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const kpi = computeKpis(txns);
  const months = monthlyAggregates(txns);
  const cats = categoryAggregates(txns);
  const merchants = merchantAggregates(txns, 8);
  const insights = generateInsights(txns);
  const health = healthScore(txns);
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = 64;

  // ── Cover / Executive summary ──
  doc.setFillColor(9, 14, 26); doc.rect(0, 0, W, 150, "F");
  doc.setTextColor(52, 211, 153);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text("FinanceIQ AI", M, 58);
  doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont("helvetica", "normal");
  doc.text("Financial Intelligence Report", M, 80);
  doc.setFontSize(9); doc.setTextColor(180, 190, 205);
  const range = txns.length ? `${[...txns].map((t) => t.date).sort()[0]}  →  ${[...txns].map((t) => t.date).sort().at(-1)}` : "—";
  doc.text(`Period: ${range}   ·   Generated ${new Date().toLocaleDateString()}   ·   ${txns.length} transactions`, M, 100);
  doc.setFontSize(11); doc.setTextColor(52, 211, 153);
  doc.text(`Financial Health Score: ${health.score}/100 (Grade ${health.grade})`, M, 126);

  y = 186;
  section(doc, "Executive Summary", y); y += 22;
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: "grid",
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [16, 24, 40], textColor: 255 },
    head: [["Total Income", "Total Expense", "Net Savings", "Savings Rate", "Current Balance", "Monthly Burn"]],
    body: [[fmtMoney(kpi.totalIncome), fmtMoney(kpi.totalExpense), fmtMoney(kpi.netSavings),
            fmtPct(kpi.savingsRate, 1), fmtMoney(kpi.currentBalance), fmtMoney(kpi.monthlyBurnRate)]],
  });
  y = lastY(doc) + 28;

  // ── Income & expense by month ──
  section(doc, "Income vs Expense by Month", y); y += 10;
  autoTable(doc, {
    startY: y + 8, margin: { left: M, right: M }, theme: "striped",
    styles: { fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: [6, 95, 70], textColor: 255 },
    head: [["Month", "Income", "Expense", "Net", "End Balance"]],
    body: months.map((m) => [m.label, fmtMoney(m.income), fmtMoney(m.expense), fmtMoney(m.net), m.endBalance != null ? fmtMoney(m.endBalance) : "—"]),
  });
  y = lastY(doc) + 28;

  // ── Expense analysis (chart drawn natively as bars) ──
  if (y > 620) { doc.addPage(); y = 64; }
  section(doc, "Expense Analysis — Category Breakdown", y); y += 20;
  const top = cats.slice(0, 8);
  const maxV = top[0]?.total ?? 1;
  const barW = W - M * 2 - 150;
  top.forEach((c, i) => {
    const by = y + i * 26;
    doc.setFontSize(9); doc.setTextColor(60, 70, 90);
    doc.text(c.category, M, by + 10);
    doc.setFillColor(6, 148, 100);
    doc.roundedRect(M + 110, by, Math.max(4, (c.total / maxV) * barW), 13, 3, 3, "F");
    doc.setTextColor(20, 26, 40);
    doc.text(`${fmtMoney(c.total)}  ·  ${fmtPct(c.share)}`, M + 116 + (c.total / maxV) * barW, by + 10);
  });
  y += top.length * 26 + 24;

  // ── Top merchants ──
  if (y > 560) { doc.addPage(); y = 64; }
  section(doc, "Top Merchants", y);
  autoTable(doc, {
    startY: y + 14, margin: { left: M, right: M }, theme: "striped",
    styles: { fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: [16, 24, 40], textColor: 255 },
    head: [["Merchant", "Category", "Transactions", "Total Spent"]],
    body: merchants.map((m) => [m.merchant, m.category, String(m.count), fmtMoney(m.total)]),
  });
  y = lastY(doc) + 28;

  // ── AI recommendations ──
  doc.addPage(); y = 64;
  section(doc, "AI Insights & Recommendations", y); y += 24;
  for (const ins of insights.slice(0, 12)) {
    if (y > 740) { doc.addPage(); y = 64; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(6, 95, 70);
    doc.text(`•  ${ins.title}`, M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 70, 90);
    const wrapped = doc.splitTextToSize(ins.body, W - M * 2 - 14);
    doc.text(wrapped, M + 14, y + 14);
    y += 20 + wrapped.length * 11;
  }

  doc.save(fileName);
}

function section(doc: jsPDF, title: string, y: number) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(15, 20, 34);
  doc.text(title, 48, y);
  doc.setDrawColor(6, 148, 100); doc.setLineWidth(2);
  doc.line(48, y + 6, 48 + doc.getTextWidth(title), y + 6);
}

function lastY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}
