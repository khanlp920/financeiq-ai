"use client";
import { MessageSquareText } from "lucide-react";
import { useFinance } from "@/hooks/use-finance-store";
import { Topbar } from "@/components/layout/topbar";
import { ChatUI } from "@/components/chat/chat-ui";
import { EmptyState, PageSkeleton } from "@/components/shared";

export default function ChatPage() {
  const { transactions, loading } = useFinance();
  return (
    <>
      <Topbar title="AI Chat" />
      <main className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:pb-4">
        {loading ? (
          <div className="py-6"><PageSkeleton /></div>
        ) : !transactions.length ? (
          <div className="py-6">
            <EmptyState
              icon={MessageSquareText}
              title="Nothing to chat about yet"
              body="Upload a statement first — then ask the AI analyst anything about your income, spending or savings."
              actionHref="/upload"
              actionLabel="Upload a statement"
            />
          </div>
        ) : (
          <ChatUI />
        )}
      </main>
    </>
  );
}
