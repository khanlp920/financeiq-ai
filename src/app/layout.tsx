import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { FinanceProvider } from "@/hooks/use-finance-store";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FinanceIQ AI — Financial intelligence for your bank statements", template: "%s · FinanceIQ AI" },
  description:
    "Upload bank statements, get AI-powered dashboards, insights, predictions, budgets and chat. Premium financial intelligence in seconds.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090e1a" },
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Fonts load at runtime so offline builds still succeed; system fallbacks cover the gap. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Spline+Sans:wght@300..700&family=Spline+Sans+Mono:wght@400..600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <FinanceProvider>{children}</FinanceProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
