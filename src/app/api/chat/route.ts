import { NextResponse } from "next/server";
import type { ChatContext } from "@/lib/chat-context";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Msg { role: "user" | "assistant"; content: string }

/**
 * POST { messages, context } → { reply }.
 * With ANTHROPIC_API_KEY set, answers come from Claude grounded in the computed
 * financial context. Without it, a deterministic local engine answers the most
 * common questions so the feature works out of the box.
 */
export async function POST(request: Request) {
  let payload: { messages?: Msg[]; context?: ChatContext };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messages = (payload.messages ?? []).filter(
    (m): m is Msg => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string"
  ).slice(-10);
  const context = payload.context;
  const last = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";

  if (!last || !context) {
    return NextResponse.json({ error: "Missing message or context." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 700,
          system:
            "You are FinanceIQ, a concise personal-finance analyst. Answer ONLY from the JSON financial summary provided. " +
            "Use exact figures, format money like $1,234.56, keep answers under 150 words, and never invent transactions. " +
            "If the data can't answer the question, say so plainly. You provide analytics, not financial advice.\n\n" +
            `FINANCIAL SUMMARY:\n${JSON.stringify(context)}`,
          messages,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { content?: { type: string; text?: string }[] };
        const reply = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
        if (reply) return NextResponse.json({ reply });
      } else {
        console.error("[/api/chat] Anthropic error", res.status, await res.text());
      }
    } catch (err) {
      console.error("[/api/chat] Anthropic request failed", err);
    }
    // fall through to local engine on any failure
  }

  return NextResponse.json({ reply: localAnswer(last, context) });
}

/* ------------------------------------------------------------------ */
/* Deterministic local answer engine (no API key required)             */
/* ------------------------------------------------------------------ */

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function lastFullMonthKey(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function localAnswer(question: string, ctx: ChatContext): string {
  const q = question.toLowerCase();

  // Category spend, optionally "last month" / "this month"
  const category = ctx.categories.find((c) => q.includes(c.category.toLowerCase()))?.category
    ?? (q.includes("grocery") || q.includes("groceries") ? "Grocery" : q.includes("food") || q.includes("dining") || q.includes("restaurant") ? "Food" : null);
  if (category) {
    const wantLast = q.includes("last month");
    const wantThis = q.includes("this month");
    if (wantLast || wantThis) {
      const key = wantLast ? lastFullMonthKey() : new Date().toISOString().slice(0, 7);
      const amt = ctx.byMonthCategory[key]?.[category] ?? 0;
      return `You spent ${money(amt)} on ${category} in ${monthLabel(key)}.`;
    }
    const total = ctx.categories.find((c) => c.category === category);
    if (total) {
      return `Across the whole period you've spent ${money(total.total)} on ${category} over ${total.count} transactions (${(total.share * 100).toFixed(1)}% of all spending).`;
    }
  }

  if (q.includes("subscription") || q.includes("recurring")) {
    if (!ctx.recurring.length) return "I didn't detect any recurring payments or subscriptions in your data.";
    const lines = ctx.recurring.map((r) => `• ${r.merchant} — about ${money(r.amount)}/month (${r.months} months, ${r.category})`);
    const total = ctx.recurring.reduce((s, r) => s + r.amount, 0);
    return `I found ${ctx.recurring.length} recurring payments totalling roughly ${money(total)}/month:\n${lines.join("\n")}`;
  }

  if (q.includes("biggest") || q.includes("largest")) {
    const t = ctx.largestExpenses[0];
    if (t) return `Your largest single expense was ${money(t.amount)} at ${t.merchant} on ${t.date} (${t.category}).`;
  }

  if (q.includes("saving") || q.includes("save enough") || q.includes("savings rate")) {
    const rate = (ctx.kpi.savingsRate * 100).toFixed(1);
    const verdict = ctx.kpi.savingsRate >= 0.2
      ? "That clears the common 20% guideline — keep it up."
      : ctx.kpi.savingsRate >= 0.1
        ? "That's below the common 20% guideline; trimming your top spending category would help."
        : "That's well below the common 20% guideline — worth reviewing your recurring costs first.";
    return `You've saved ${money(ctx.kpi.netSavings)} in total — a savings rate of ${rate}%. ${verdict} Your financial health score is ${ctx.health.score}/100 (${ctx.health.grade}).`;
  }

  if (q.includes("income")) {
    const avg = ctx.months.length ? ctx.months.reduce((s, m) => s + m.income, 0) / ctx.months.length : 0;
    return `Total income over the period is ${money(ctx.kpi.totalIncome)}, averaging ${money(avg)} per month.`;
  }

  if (q.includes("balance")) {
    return `Your current balance is ${money(ctx.kpi.currentBalance)}.`;
  }

  if (q.includes("merchant") || q.includes("where") && q.includes("spend")) {
    const top = ctx.topMerchants.slice(0, 5).map((m, i) => `${i + 1}. ${m.merchant} — ${money(m.total)}`);
    return `Your top merchants by total spend:\n${top.join("\n")}`;
  }

  // Default: quick overview
  return [
    `Here's a quick overview of your ${ctx.txnCount.toLocaleString()} transactions:`,
    `• Income ${money(ctx.kpi.totalIncome)} · Expenses ${money(ctx.kpi.totalExpense)} · Net ${money(ctx.kpi.netSavings)}`,
    `• Savings rate ${(ctx.kpi.savingsRate * 100).toFixed(1)}% · Health score ${ctx.health.score}/100 (${ctx.health.grade})`,
    `• Top category: ${ctx.categories[0]?.category ?? "—"} at ${money(ctx.categories[0]?.total ?? 0)}`,
    ``,
    `Try asking about a specific category, month, merchant or your subscriptions. (Tip: set ANTHROPIC_API_KEY for full AI answers.)`,
  ].join("\n");
}
