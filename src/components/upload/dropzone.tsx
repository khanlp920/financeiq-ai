"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, FileSpreadsheet, FileText, Loader2, UploadCloud, XCircle } from "lucide-react";
import { parseCsv, parseXlsx } from "@/lib/parsers";
import { useFinance } from "@/hooks/use-finance-store";
import { cn, uid } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import type { StatementFile, Transaction } from "@/lib/types";
import type { CurrencyCode } from "@/lib/currency";

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
const ACCEPTED = [".pdf", ".csv", ".xlsx", ".xls"];

interface Job {
  id: string;
  name: string;
  size: number;
  status: "parsing" | "done" | "error";
  progress: number;
  rows: number;
  error?: string;
}

export function UploadDropzone({ onDone }: { onDone?: (added: number) => void }) {
  const { addTransactions } = useFinance();
  const [drag, setDrag] = React.useState(false);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const patch = (id: string, p: Partial<Job>) =>
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...p } : j)));

  async function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      const id = uid();
      const job: Job = { id, name: file.name, size: file.size, status: "parsing", progress: 8, rows: 0 };
      setJobs((prev) => [job, ...prev]);

      if (!ACCEPTED.includes(ext)) {
        patch(id, { status: "error", progress: 100, error: `Unsupported type ${ext}. Use PDF, CSV or Excel.` });
        continue;
      }
      if (file.size > MAX_SIZE) {
        patch(id, { status: "error", progress: 100, error: "File exceeds the 15 MB limit." });
        continue;
      }

      try {
        const statementId = uid();
        let txns: Transaction[] = [];
        // Progress: parsing is fast; animate to look honest, then jump on finish.
        const tick = setInterval(() => {
          setJobs((prev) => prev.map((j) => (j.id === id && j.status === "parsing" && j.progress < 82 ? { ...j, progress: j.progress + 6 } : j)));
        }, 120);

        let detectedCurrency: CurrencyCode | null = null;
        const serverParse = async (): Promise<Transaction[]> => {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("statementId", statementId);
          const res = await fetch("/api/parse", { method: "POST", body: fd });
          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as { error?: string } | null;
            throw new Error(body?.error ?? `Server parse failed (${res.status})`);
          }
          const body = (await res.json()) as { transactions: Transaction[]; currency?: CurrencyCode | null };
          detectedCurrency = body.currency ?? null;
          return body.transactions;
        };

        if (ext === ".csv") {
          txns = await parseCsv(file, statementId).catch(() => []);
          // Nonstandard export? Server route retries with the AI parser.
          if (txns.length < 3) txns = await serverParse();
        } else if (ext === ".xlsx" || ext === ".xls") {
          txns = await parseXlsx(file, statementId).catch(() => []);
          if (txns.length < 3) txns = await serverParse();
        } else {
          // PDF → always server-side (pdf-parse + AI fallback for any layout)
          txns = await serverParse();
        }
        clearInterval(tick);

        if (!txns.length) {
          patch(id, { status: "error", progress: 100, error: "No transactions detected in this file." });
          continue;
        }

        const stmt: StatementFile = {
          id: statementId,
          fileName: file.name,
          fileType: ext === ".csv" ? "csv" : ext === ".pdf" ? "pdf" : "xlsx",
          uploadedAt: new Date().toISOString(),
          rowCount: txns.length,
          bankName: txns.find((t) => t.bankName)?.bankName ?? null,
        };
        await addTransactions(txns, stmt, file, detectedCurrency);
        patch(id, { status: "done", progress: 100, rows: txns.length });
        onDone?.(txns.length);
      } catch (err) {
        patch(id, { status: "error", progress: 100, error: err instanceof Error ? err.message : "Parsing failed." });
      }
    }
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload bank statements"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        className={cn(
          "glass grid cursor-pointer place-items-center px-6 py-14 text-center transition-all",
          drag && "border-primary bg-primary/[.06] shadow-glow"
        )}
      >
        <motion.span
          animate={drag ? { scale: 1.08, rotate: -4 } : { scale: 1, rotate: 0 }}
          className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/12 text-primary"
        >
          <UploadCloud className="h-7 w-7" />
        </motion.span>
        <h3 className="mt-4 font-display text-lg">{drag ? "Drop to analyze" : "Drag & drop statements"}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF · CSV · Excel — up to 15 MB. Or <span className="text-primary underline">browse files</span>.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      <AnimatePresence>
        {jobs.map((job) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass flex items-center gap-4 p-4"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted">
              {job.name.endsWith(".pdf") ? <FileText className="h-5 w-5" /> : <FileSpreadsheet className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{job.name}</p>
                <span className="text-xs text-muted-foreground">{(job.size / 1024).toFixed(0)} KB</span>
              </div>
              <Progress value={job.progress} className="mt-2 h-1.5" indicatorClassName={job.status === "error" ? "bg-destructive" : undefined} />
              {job.status === "done" && <p className="mt-1.5 text-xs text-success">Parsed & categorized {job.rows.toLocaleString()} transactions.</p>}
              {job.status === "error" && <p className="mt-1.5 text-xs text-destructive">{job.error}</p>}
            </div>
            {job.status === "parsing" && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            {job.status === "done" && <CheckCircle2 className="h-5 w-5 text-success" />}
            {job.status === "error" && <XCircle className="h-5 w-5 text-destructive" />}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
