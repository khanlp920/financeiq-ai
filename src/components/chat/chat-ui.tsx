"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, SendHorizonal, Sparkles, User } from "lucide-react";
import { useFinance } from "@/hooks/use-finance-store";
import { buildChatContext } from "@/lib/chat-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Msg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "How much did I spend on food last month?",
  "What subscriptions am I paying for?",
  "Am I saving enough?",
  "What was my biggest expense this year?",
];

export function ChatUI() {
  const { transactions } = useFinance();
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-10), context: buildChatContext(transactions) }),
      });
      const body = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !body.reply) throw new Error(body.error ?? "Chat failed");
      setMessages((m) => [...m, { role: "assistant", content: body.reply! }]);
    } catch {
      setMessages((m) => [...m, {
        role: "assistant",
        content: "I hit a snag answering that. Try rephrasing, or check that the app server is running.",
      }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col lg:h-[calc(100dvh-7rem)]">
      <div className="flex-1 space-y-4 overflow-y-auto py-4 pr-1">
        {!messages.length && (
          <div className="grid h-full place-items-center">
            <div className="text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/12 text-primary">
                <Sparkles className="h-7 w-7" />
              </span>
              <h2 className="mt-4 font-display text-xl">Ask anything about your money</h2>
              <p className="mt-1 text-sm text-muted-foreground">Answers are grounded in your parsed transactions.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="rounded-full border bg-card/60 px-3.5 py-1.5 text-xs backdrop-blur transition-colors hover:border-primary/50 hover:text-primary">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <span className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </span>
              <div className={cn(
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                m.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "glass rounded-tl-sm"
              )}>
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted"><Bot className="h-4 w-4" /></span>
            <div className="glass rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="glass flex items-center gap-2 p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. How much did I spend on groceries in June?"
          className="h-10 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Chat message"
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
          <SendHorizonal className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
