"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Search, User as UserIcon } from "lucide-react";
import { useFinance } from "@/hooks/use-finance-store";
import { supabaseConfigured } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandSearch } from "@/components/layout/command-search";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar({ title }: { title: string }) {
  const { user, demoMode, signOut } = useFinance();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initials = (user?.email ?? "Guest").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/70 px-4 backdrop-blur-xl sm:px-6">
      <h1 className="font-display text-xl tracking-tight sm:text-2xl">{title}</h1>
      {demoMode && <Badge variant="warning">Demo data</Badge>}
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="outline"
          className="hidden w-56 justify-start gap-2 text-muted-foreground sm:flex"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
          Search transactions…
          <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px]">⌘K</kbd>
        </Button>
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setSearchOpen(true)} aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Account menu" className="rounded-full outline-none ring-ring focus-visible:ring-2">
              <Avatar><AvatarFallback>{initials}</AvatarFallback></Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">
              {user?.email ?? "Guest session"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <UserIcon /> Profile & settings
            </DropdownMenuItem>
            {supabaseConfigured() ? (
              user ? (
                <DropdownMenuItem onClick={async () => { await signOut(); router.push("/login"); }}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => router.push("/login")}>
                  <LogOut /> Sign in
                </DropdownMenuItem>
              )
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
