"use client";
/** Marketing landing page. */
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, BrainCircuit, LineChart, Lock, MessageSquareText,
  PiggyBank, Sparkles, UploadCloud, Zap,
} from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { supabaseConfigured } from "@/lib/supabase/client";

const FEATURES = [
  { icon: UploadCloud, title: "Drop any statement", body: "PDF, CSV or Excel from any bank. We parse, normalize and de-duplicate every row automatically." },
  { icon: BrainCircuit, title: "AI categorization", body: "18 smart categories, merchant extraction, subscription and anomaly detection — no manual tagging." },
  { icon: LineChart, title: "Predictive cash flow", body: "End-of-month balance, burn rate and six-month savings forecasts with confidence bands." },
  { icon: MessageSquareText, title: "Chat with your money", body: "Ask “what subscriptions can I cancel?” and get an answer grounded in your actual data." },
  { icon: PiggyBank, title: "Budgets that fight back", body: "Per-category budgets with live progress, forecast-to-finish and overspend alerts." },
  { icon: Lock, title: "Private by design", body: "Row-level security, private file storage, and an on-device analytics engine." },
];

export default function LandingPage() {
  return (
    <div className="mesh grain min-h-screen">
      <header className="container flex h-16 items-center justify-between">
        <Logo href="/" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {supabaseConfigured() && (
            <Button variant="ghost" asChild><Link href="/login">Sign in</Link></Button>
          )}
          <Button asChild>
            <Link href="/dashboard">Open app <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </header>

      <main className="container">
        <section className="mx-auto max-w-3xl pb-20 pt-24 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" /> AI financial intelligence
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.08 }}
            className="mt-6 font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl"
          >
            Your bank statement,{" "}
            <span className="bg-gradient-to-r from-primary to-[hsl(var(--chart-2))] bg-clip-text text-transparent">
              finally intelligent.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.16 }}
            className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground"
          >
            Upload a statement. Get dashboards, categorized spending, subscription audits,
            anomaly alerts, forecasts and an AI analyst — in seconds.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.24 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Button size="lg" asChild className="shadow-glow">
              <Link href="/dashboard"><Zap className="h-4 w-4" /> Try the live demo</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/upload">Upload a statement</Link>
            </Button>
          </motion.div>
          <p className="mt-4 text-xs text-muted-foreground">No signup needed for the demo · Nothing leaves your browser</p>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.06, duration: 0.45 }}
              className="glass p-6"
            >
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/12 text-primary">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} FinanceIQ AI</span>
          <span>Built with Next.js · Supabase · Recharts</span>
        </div>
      </footer>
    </div>
  );
}
