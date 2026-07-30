import Link from "next/link";
import { Sparkles } from "lucide-react";

export function Logo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glow">
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="font-display text-lg tracking-tight">
        FinanceIQ <span className="text-primary">AI</span>
      </span>
    </Link>
  );
}
