# FinanceIQ AI

AI-powered financial intelligence. Upload bank statements (PDF / CSV / Excel), get a premium
dashboard with categorized transactions, insights, budgets, predictions, an AI chat analyst and
downloadable reports.

Built with **Next.js 15 · React 19 · TypeScript (strict) · Tailwind CSS · shadcn/ui · Framer Motion ·
Recharts · Supabase**.

---

## Quick start (zero config — demo mode)

```bash
npm install
npm run dev
```

Open http://localhost:3000 → **Try the live demo**. With no environment variables set, the app runs
fully client-side: a realistic 15-month demo dataset loads instantly, uploads parse in the browser
(PDFs via the local API route) and everything persists to `localStorage`. Nothing leaves your machine.

A test file is included at `sample-data/sample-statement.csv` — drag it onto the Upload page.

## Full setup (Supabase auth + cloud sync)

1. Create a project at https://supabase.com.
2. In the SQL editor, run `supabase/migrations/0001_init.sql`. This creates `profiles`,
   `statements`, `transactions`, `budgets` — all with row-level security ("users see only their own
   rows") — plus a private `statements` storage bucket with per-user folder policies.
3. Copy `.env.example` → `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
ANTHROPIC_API_KEY=sk-ant-...   # optional — enables full AI chat
```

4. **Google login (optional):** Supabase Dashboard → Authentication → Providers → Google → enable,
   and add your Google OAuth client ID/secret (callback URL is shown in the dashboard,
   `https://YOUR-PROJECT.supabase.co/auth/v1/callback`). Also add your site URL under
   Authentication → URL Configuration.
5. `npm run dev` — sign up, confirm email, sign in. Uploads now sync to Postgres + Storage.

Signed-out visitors still get demo mode; signing in migrates to cloud-scoped data.

## AI chat

- **Without `ANTHROPIC_API_KEY`:** a built-in deterministic engine answers common questions
  ("How much did I spend on food last month?", "What subscriptions am I paying for?", "Am I saving
  enough?") from your computed financial summary.
- **With the key:** `/api/chat` calls Claude with a compact JSON summary of your finances as
  grounding context. The key stays server-side.

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or push to GitHub and import the repo at https://vercel.com/new. Set the three environment
variables from `.env.example` in Project → Settings → Environment Variables. `vercel.json`
already raises the function timeout for PDF parsing. That's it — the build is a standard
`next build`.

## Scripts

| Command             | Purpose                       |
| ------------------- | ----------------------------- |
| `npm run dev`       | Dev server                    |
| `npm run build`     | Production build              |
| `npm run start`     | Serve production build        |
| `npm run lint`      | ESLint                        |
| `npm run typecheck` | `tsc --noEmit` (strict)       |

## Architecture notes

- **Data layer** (`src/hooks/use-finance-store.tsx`): Supabase when configured & signed in →
  `localStorage` otherwise → seeded demo dataset when empty. First real upload replaces demo data;
  duplicate rows (same date+description+amount) are skipped on import.
- **Parsing** (`src/lib/parsers/`): CSV via PapaParse, Excel via SheetJS with header-row
  auto-detection, PDF via `pdf-parse` on the server with a heuristic line parser (dates,
  continuation lines, debit/credit/balance column inference). Header aliases handle most bank
  export formats.
- **Categorization** (`src/lib/categorize.ts`): direction-aware regex rules across 18 categories +
  merchant extraction. Deterministic, instant, offline.
- **Analytics** (`src/lib/finance.ts`, `insights.ts`, `predictions.ts`): KPIs, monthly/category/
  merchant aggregates, recurring-payment & duplicate detection, anomaly flags (mean + 2.5σ),
  financial health score (savings rate 40%, income stability 25%, category balance 15%, surplus
  months 20%), EOM balance forecast with a ±1σ·√days confidence band and a 6-month savings
  projection from a least-squares trend.
- **Exports** (`src/lib/export.ts`): CSV, two-sheet Excel workbook, and a styled multi-page PDF
  report (cover with health score, executive summary, monthly analysis, category chart, top
  merchants, recommendations) generated client-side with jsPDF.
- **Security:** RLS on every table, private storage bucket, per-user folders, no service-role key
  anywhere in the app, Anthropic key server-only.

## Project structure

```
src/
  app/                 # routes: landing, auth, (app)/dashboard|transactions|upload|insights|
  │                    #         budgets|predictions|chat|reports|settings, api/parse, api/chat
  components/          # ui/ (shadcn-style), layout/, dashboard/, upload/, transactions/,
  │                    # budgets/, chat/, shared.tsx
  hooks/               # use-finance-store (data layer)
  lib/                 # types, parsers/, categorize, finance, insights, predictions,
                       # export, chat-context, supabase/
supabase/migrations/   # 0001_init.sql (schema + RLS + storage policies)
sample-data/           # sample-statement.csv
```
