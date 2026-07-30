"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, FileText, LayoutDashboard, LineChart, MessageSquareText,
  PiggyBank, Receipt, Settings, Sparkles, UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/upload", label: "Upload", icon: UploadCloud },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/predictions", label: "Predictions", icon: LineChart },
  { href: "/chat", label: "AI Chat", icon: MessageSquareText },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-card/40 backdrop-blur-xl lg:flex">
      <div className="flex h-16 items-center gap-2 px-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />}
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <div className="flex items-center gap-2 rounded-md bg-accent/60 px-3 py-2 text-xs text-accent-foreground">
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Bank-grade insight, on-device math.</span>
        </div>
      </div>
    </aside>
  );
}

/** Bottom tab bar on mobile */
export function MobileNav() {
  const pathname = usePathname();
  const items = NAV.slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card/80 backdrop-blur-xl lg:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
