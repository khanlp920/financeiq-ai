"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { UploadCloud, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Titled glass card wrapping a chart, with staggered entrance. */
export function ChartCard({
  title, sub, children, index = 0, className,
}: { title: string; sub?: string; children: React.ReactNode; index?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: index * 0.05, duration: 0.45, ease: [0.21, 0.65, 0.34, 1] }}
      className={className}
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  );
}

/** Beautiful empty state used across pages when no data matches. */
export function EmptyState({
  icon: Icon = UploadCloud, title, body, actionHref, actionLabel,
}: { icon?: LucideIcon; title: string; body: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="glass grid place-items-center px-6 py-16 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 animate-float rounded-full bg-primary/15 blur-2xl" />
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/12 text-primary">
          <Icon className="h-7 w-7" />
        </span>
      </div>
      <h3 className="mt-5 font-display text-lg">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{body}</p>
      {actionHref && actionLabel && (
        <Button asChild className="mt-5"><Link href={actionHref}>{actionLabel}</Link></Button>
      )}
    </div>
  );
}

/** Full-page loading skeleton (KPI row + two chart blocks). */
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
