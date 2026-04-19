import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  // تحقق من أن الطلب من Vercel Cron
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

    const jsonContent = JSON.stringify(backup, null, 2);
    const base64Content = Buffer.from(jsonContent).toString("base64");

    const summaryText = Object.entries(summary)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.BACKUP_EMAIL!,
      subject: `MARSA Backup - ${timestamp}`,
      html: `
        <h2>نسخة احتياطية يومية - مرسى</h2>
        <p><strong>التاريخ:</strong> ${timestamp}</p>
        <h3>ملخص:</h3>
        <pre>${summaryText}</pre>
        <p>الملف المرفق يحتوي على النسخة الكاملة بصيغة JSON.</p>
      `,
      attachments: [{
        filename: `marsa-backup-${timestamp}.json`,
        content: base64Content,
      }],
    });

    await prisma.$disconnect();
    return Response.json({ success: true, timestamp, summary });
  } catch (error: unknown) {
    console.error("Backup failed:", error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
