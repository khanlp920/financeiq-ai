"use client";
import * as React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: "default" | "good" | "bad" | "warn";
  index?: number;
}

export function KpiCard({ label, value, sub, icon: Icon, tone = "default", index = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.21, 0.65, 0.34, 1] }}
    >
      <Card className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/[.07] blur-2xl" />
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <span className={cn(
            "grid h-8 w-8 place-items-center rounded-lg",
            tone === "good" && "bg-success/15 text-success",
            tone === "bad" && "bg-destructive/15 text-destructive",
            tone === "warn" && "bg-warning/15 text-warning",
            tone === "default" && "bg-primary/12 text-primary"
          )}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="tnum mt-3 font-display text-2xl tracking-tight sm:text-[1.7rem]">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </Card>
    </motion.div>
  );
}
