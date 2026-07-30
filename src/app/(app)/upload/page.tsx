"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Files, ShieldCheck } from "lucide-react";
import { useFinance } from "@/hooks/use-finance-store";
import { fmtDate } from "@/lib/utils";
import { Topbar } from "@/components/layout/topbar";
import { UploadDropzone } from "@/components/upload/dropzone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UploadPage() {
  const { statements, user } = useFinance();
  const [added, setAdded] = React.useState(0);

  return (
    <>
      <Topbar title="Upload statements" />
      <main className="mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-6 lg:pb-8">
        <UploadDropzone onDone={(n) => setAdded((a) => a + n)} />

        {added > 0 && (
          <div className="glass flex items-center justify-between p-4">
            <p className="text-sm">
              <span className="font-medium text-success">{added.toLocaleString()} transactions</span> imported and categorized.
            </p>
            <Button asChild size="sm">
              <Link href="/dashboard">View dashboard <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        )}

        {statements.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Files className="h-4 w-4" /> Uploaded statements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {statements.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(s.uploadedAt.slice(0, 10))} · {s.rowCount.toLocaleString()} rows{s.bankName ? ` · ${s.bankName}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary" className="uppercase">{s.fileType}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            {user
              ? "Files are stored in your private, RLS-protected Supabase bucket. Parsed rows are scoped to your account only."
              : "You're not signed in — parsing runs in your browser and data stays in this device's local storage. Sign in to sync to the cloud."}
            {" "}A ready-made test file lives at <code className="rounded bg-muted px-1 font-mono text-xs">sample-data/sample-statement.csv</code>.
          </p>
        </div>
      </main>
    </>
  );
}
