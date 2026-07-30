import { NextResponse } from "next/server";
import { parsePdfText } from "@/lib/parsers/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SIZE = 15 * 1024 * 1024;

/** POST multipart/form-data { file, statementId } → parsed transactions from a PDF statement. */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const statementId = String(form.get("statementId") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds the 15 MB limit." }, { status: 413 });
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are parsed server-side." }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // Dynamic import keeps pdf-parse out of the edge/client bundles.
    const { default: pdfParse } = await import("pdf-parse");
    const parsed = await pdfParse(buffer);
    const transactions = parsePdfText(parsed.text ?? "", statementId);

    return NextResponse.json({ transactions });
  } catch (err) {
    console.error("[/api/parse]", err);
    return NextResponse.json(
      { error: "Could not read this PDF. If it's a scanned image, export a CSV from your bank instead." },
      { status: 422 }
    );
  }
}
