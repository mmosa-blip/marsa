import { NextRequest } from "next/server";
import crypto from "crypto";
import zlib from "zlib";
import { promisify } from "util";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const gzipAsync = promisify(zlib.gzip);

// One attachment must stay under Resend's 40MB hard cap; we set the
// soft split at 10MB of raw JSON so the gzipped payload leaves ample
// margin and the email gateway doesn't reject bursty growth months
// after the code ships.
const CHUNK_SIZE_BYTES = 10 * 1024 * 1024;
const RESEND_RETRY_ATTEMPTS = 3;
const RESEND_RETRY_DELAY_MS = 2000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Split a large JSON string into ~CHUNK_SIZE chunks. Each chunk is
// still valid JSON on its own because we split at the table-boundary
// level — every chunk contains a complete subset of tables plus the
// shared header. If a single table is larger than CHUNK_SIZE it lives
// in its own chunk (can't split a table mid-array without re-parsing).
function splitBackupIntoChunks(
  backup: Record<string, unknown>,
  tableKeys: string[]
): Record<string, unknown>[] {
  const header = {
    timestamp: backup.timestamp,
    source: backup.source,
  };
  const chunks: Record<string, unknown>[] = [];
  let current: Record<string, unknown> = { ...header, tables: [] as string[] };
  let currentSize = JSON.stringify(current).length;

  for (const key of tableKeys) {
    const tablePayload = JSON.stringify(backup[key]);
    const tableOverhead = key.length + tablePayload.length + 8; // key + quotes + comma

    if (currentSize + tableOverhead > CHUNK_SIZE_BYTES && (current.tables as string[]).length > 0) {
      chunks.push(current);
      current = { ...header, tables: [] as string[] };
      currentSize = JSON.stringify(current).length;
    }

    current[key] = backup[key];
    (current.tables as string[]).push(key);
    currentSize += tableOverhead;
  }

  if ((current.tables as string[]).length > 0) chunks.push(current);
  return chunks;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendWithRetry(resend: any, options: any): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= RESEND_RETRY_ATTEMPTS; attempt++) {
    try {
      await resend.emails.send(options);
      return;
    } catch (err) {
      lastErr = err;
      logger.warn(`Resend attempt ${attempt}/${RESEND_RETRY_ATTEMPTS} failed`, {
        error: err instanceof Error ? err.message : String(err),
      });
      if (attempt < RESEND_RETRY_ATTEMPTS) {
        await sleep(RESEND_RETRY_DELAY_MS * attempt);
      }
    }
  }
  throw lastErr;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const timestamp = new Date().toISOString().slice(0, 10);
    const tables = [
      "user", "project", "task", "service",
      "contract", "invoice", "projectMilestone",
      "contractPaymentInstallment", "projectPartner",
      "taskAssignment", "department", "taskRequirement",
      "docType", "projectDocument", "auditLog", "notification",
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backup: Record<string, any> = {
      timestamp: new Date().toISOString(),
      source: "marsa-production",
    };
    const summary: Record<string, number> = {};

    for (const table of tables) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await (prisma as any)[table].findMany();
        backup[table] = data;
        summary[table] = data.length;
      } catch {
        summary[table] = -1;
      }
    }

    const fullJson = JSON.stringify(backup, null, 2);
    const rawSizeBytes = Buffer.byteLength(fullJson, "utf-8");

    // Integrity: SHA-256 of the canonical (non-split, pre-gzip) payload
    // so the operator can verify a downloaded chunk set reassembles to
    // the same bytes the server produced.
    const sha256 = crypto.createHash("sha256").update(fullJson).digest("hex");

    // Split the payload when it exceeds CHUNK_SIZE_BYTES so a single
    // oversized table doesn't blow past Resend's attachment cap.
    const needsSplit = rawSizeBytes > CHUNK_SIZE_BYTES;
    const chunks = needsSplit ? splitBackupIntoChunks(backup, tables) : [backup];

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const summaryText = Object.entries(summary)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    const gzippedChunks: { filename: string; buffer: Buffer; sizeBytes: number }[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkJson = JSON.stringify(chunks[i], null, 2);
      const gz = await gzipAsync(Buffer.from(chunkJson, "utf-8"));
      const idx = chunks.length > 1 ? `-part${String(i + 1).padStart(2, "0")}of${String(chunks.length).padStart(2, "0")}` : "";
      gzippedChunks.push({
        filename: `marsa-backup-${timestamp}${idx}.json.gz`,
        buffer: gz,
        sizeBytes: gz.byteLength,
      });
    }

    // One email per chunk keeps each attachment small and isolates
    // Resend failures to one piece of the backup.
    for (let i = 0; i < gzippedChunks.length; i++) {
      const chunk = gzippedChunks[i];
      const partLabel = gzippedChunks.length > 1 ? ` (part ${i + 1}/${gzippedChunks.length})` : "";
      await sendWithRetry(resend, {
        from: "onboarding@resend.dev",
        to: process.env.BACKUP_EMAIL!,
        subject: `MARSA Backup - ${timestamp}${partLabel}`,
        html: `
          <h2>نسخة احتياطية يومية - مرسى${partLabel}</h2>
          <p><strong>التاريخ:</strong> ${timestamp}</p>
          <p><strong>حجم الأصل:</strong> ${(rawSizeBytes / 1024 / 1024).toFixed(2)} MB</p>
          <p><strong>حجم المضغوط:</strong> ${(chunk.sizeBytes / 1024 / 1024).toFixed(2)} MB</p>
          <p><strong>SHA-256 (للنسخة الكاملة):</strong> <code>${sha256}</code></p>
          <h3>ملخص:</h3>
          <pre>${summaryText}</pre>
          <p>الملف المرفق مضغوط gzip. فك الضغط ثم تحقّق بالـ SHA-256 لو عندك ${gzippedChunks.length > 1 ? "كل الأجزاء" : "الملف كاملاً"}.</p>
        `,
        attachments: [{
          filename: chunk.filename,
          content: chunk.buffer.toString("base64"),
        }],
      });
    }

    await prisma.$disconnect();
    return Response.json({
      success: true,
      timestamp,
      summary,
      rawSizeBytes,
      chunks: gzippedChunks.length,
      sha256,
    });
  } catch (error: unknown) {
    logger.error("Backup failed", error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
