import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { createAuditLog, AuditModule } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { countWorkingDays } from "@/lib/working-days";

// GET /api/projects/[id]/celebration/report
//
// Returns a printable HTML page (auto-prints on load) summarizing the
// completed project: cover, totals, services, milestones, installments.
// The browser's native Save-as-PDF turns it into the actual PDF — same
// pattern as the existing delay/duration/contract exporters in this
// codebase. jsPDF is intentionally NOT used because its default fonts
// can't shape Arabic glyphs.
//
// Auth: ADMIN / MANAGER. Status must be COMPLETED.

export const runtime = "nodejs";

function escape(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmtHijri(d: Date | string | null | undefined): string {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(d));
  } catch {
    return "";
  }
}

function fmtAmount(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const SERVICE_STATUS_AR: Record<string, string> = {
  COMPLETED: "مكتملة",
  IN_PROGRESS: "قيد التنفيذ",
  PENDING: "بانتظار البدء",
  ACTIVE: "نشطة",
  CANCELLED: "ملغاة",
};

const MILESTONE_STATUS_AR: Record<string, string> = {
  LOCKED: "مقفلة",
  UNLOCKED: "مفتوحة",
  COMPLETED: "مكتملة",
  IN_PROGRESS: "قيد التنفيذ",
};

const PAYMENT_STATUS_AR: Record<string, string> = {
  UNPAID: "غير مدفوعة",
  PARTIAL: "جزئية",
  PAID: "مدفوعة",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER"]);
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        projectCode: true,
        status: true,
        startDate: true,
        closedAt: true,
        updatedAt: true,
        client: { select: { name: true, phone: true } },
        services: {
          where: { deletedAt: null },
          orderBy: { serviceOrder: "asc" },
          select: {
            id: true,
            name: true,
            duration: true,
            status: true,
            tasks: { where: { deletedAt: null }, select: { id: true, status: true } },
          },
        },
        milestones: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            updatedAt: true,
          },
        },
        contract: {
          select: {
            installments: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                order: true,
                title: true,
                amount: true,
                paidAmount: true,
                paymentStatus: true,
                paidAt: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      return new Response(
        JSON.stringify({ error: "المشروع غير موجود" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    if (project.status !== "COMPLETED") {
      return new Response(
        JSON.stringify({
          error: "التقرير الاحتفالي متاح فقط للمشاريع المكتملة",
          status: project.status,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    const completedDate = project.closedAt ?? project.updatedAt;
    const workingDays =
      project.startDate && completedDate
        ? countWorkingDays(project.startDate, completedDate)
        : null;

    const totalTasks = project.services.reduce((sum, s) => sum + s.tasks.length, 0);
    const doneTasks = project.services.reduce(
      (sum, s) => sum + s.tasks.filter((t) => t.status === "DONE").length,
      0
    );
    const installments = project.contract?.installments ?? [];

    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name ?? undefined,
      userRole: session.user.role,
      action: "PROJECT_CELEBRATION_DOWNLOADED",
      module: AuditModule.PROJECTS,
      severity: "INFO",
      entityType: "Project",
      entityId: project.id,
      entityName: project.name,
      meta: { type: "report" },
    });

    const clientName = project.client?.name ?? "";

    const servicesRows = project.services.length === 0
      ? `<tr><td colspan="3" class="empty">لا توجد خدمات مسجَّلة</td></tr>`
      : project.services
          .map((s) => {
            const total = s.tasks.length;
            const done = s.tasks.filter((t) => t.status === "DONE").length;
            const status = SERVICE_STATUS_AR[s.status ?? ""] ?? s.status ?? "—";
            const dur = s.duration != null ? `${s.duration} يوم` : "—";
            return `<tr>
              <td>${escape(s.name)}</td>
              <td>${dur} <span class="muted">(${done}/${total} مهمة)</span></td>
              <td><span class="badge">${escape(status)}</span></td>
            </tr>`;
          })
          .join("");

    const milestonesRows = project.milestones.length === 0
      ? `<tr><td colspan="3" class="empty">لا توجد مراحل</td></tr>`
      : project.milestones
          .map((m) => {
            const status = MILESTONE_STATUS_AR[m.status] ?? m.status;
            return `<tr>
              <td>${escape(m.title)}</td>
              <td>${escape(m.type)}</td>
              <td>${escape(status)} · ${fmtDate(m.updatedAt)}</td>
            </tr>`;
          })
          .join("");

    const installmentsRows = installments.length === 0
      ? `<tr><td colspan="4" class="empty">لا توجد دفعات</td></tr>`
      : installments
          .map((i) => {
            const status = PAYMENT_STATUS_AR[i.paymentStatus] ?? i.paymentStatus;
            return `<tr>
              <td>${escape(i.title)}</td>
              <td>${fmtAmount(i.amount)} ر.س</td>
              <td>${fmtDate(i.paidAt)}</td>
              <td><span class="badge ${i.paymentStatus === "PAID" ? "badge-paid" : ""}">${escape(status)}</span></td>
            </tr>`;
          })
          .join("");

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>تقرير إنجاز — ${escape(project.name)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4; margin: 16mm 14mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: "Tajawal", "Segoe UI", sans-serif;
      color: #1C1B2E; background: #fff; direction: rtl;
    }
    .cover {
      background: linear-gradient(135deg, #1B2A4A 0%, #5E5495 55%, #C9A84C 100%);
      color: #fff;
      padding: 48px 36px;
      border-radius: 16px;
      margin-bottom: 24px;
      page-break-after: always;
      min-height: 240mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .cover-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .brand { font-size: 36px; font-weight: 700; letter-spacing: 2px; }
    .cover-mid { text-align: center; padding: 40px 20px; }
    .cover-mid h1 { font-size: 56px; font-weight: 700; margin: 0 0 24px; }
    .cover-mid .project-name { font-size: 32px; font-weight: 700; margin: 8px 0 32px; opacity: 0.95; }
    .cover-mid .client { font-size: 22px; opacity: 0.9; margin-bottom: 28px; }
    .cover-mid .date { font-size: 18px; opacity: 0.8; }
    .cover-bottom { text-align: center; font-size: 14px; opacity: 0.75; }
    h2 { font-size: 22px; color: #5E5495; border-bottom: 2px solid #C9A84C; padding-bottom: 6px; margin: 24px 0 12px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .summary .stat {
      background: #FAFAFE;
      border: 1px solid #E2E0D8;
      border-radius: 10px;
      padding: 14px;
      text-align: center;
    }
    .summary .stat .num { font-size: 26px; font-weight: 700; color: #C9A84C; display: block; }
    .summary .stat .lbl { font-size: 12px; color: #6B7280; margin-top: 4px; }
    table {
      width: 100%; border-collapse: collapse; margin-bottom: 24px;
      font-size: 13px;
    }
    th, td {
      border: 1px solid #E2E0D8;
      padding: 8px 10px;
      text-align: right;
    }
    th { background: #F8F6EE; color: #1C1B2E; font-weight: 700; }
    td.empty { text-align: center; color: #9CA3AF; padding: 18px; }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      background: #F0EDE6;
      color: #4B5563;
      font-size: 11px;
      font-weight: 700;
    }
    .badge-paid { background: rgba(5,150,105,0.12); color: #047857; }
    .muted { color: #9CA3AF; font-size: 11px; }
    .footer {
      margin-top: 32px; padding-top: 14px;
      border-top: 1px solid #E2E0D8;
      text-align: center; font-size: 12px; color: #6B7280;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <section class="cover">
    <div class="cover-top">
      <div class="brand">مرسى</div>
      <div style="font-size:14px;opacity:0.8">${escape(project.projectCode ?? "")}</div>
    </div>
    <div class="cover-mid">
      <h1>🎉 شهادة إنجاز</h1>
      <div class="project-name">${escape(project.name)}</div>
      <div class="client">${clientName ? `للعميل: ${escape(clientName)}` : ""}</div>
      <div class="date">
        ${fmtDate(completedDate)}<br/>
        <span style="font-size:14px;opacity:0.7">${escape(fmtHijri(completedDate))}</span>
      </div>
    </div>
    <div class="cover-bottom">bmarsa.com</div>
  </section>

  <h2>الملخص</h2>
  <div class="summary">
    <div class="stat"><span class="num">${workingDays ?? "—"}</span><div class="lbl">يوم عمل</div></div>
    <div class="stat"><span class="num">${project.services.length}</span><div class="lbl">خدمة</div></div>
    <div class="stat"><span class="num">${doneTasks}/${totalTasks}</span><div class="lbl">مهمة منجزة</div></div>
    <div class="stat"><span class="num">${project.milestones.length}</span><div class="lbl">مرحلة</div></div>
  </div>

  <h2>الخدمات</h2>
  <table>
    <thead><tr><th>الخدمة</th><th>المدة</th><th>الحالة</th></tr></thead>
    <tbody>${servicesRows}</tbody>
  </table>

  <h2>المراحل</h2>
  <table>
    <thead><tr><th>العنوان</th><th>النوع</th><th>الحالة / آخر تحديث</th></tr></thead>
    <tbody>${milestonesRows}</tbody>
  </table>

  <h2>الأقساط</h2>
  <table>
    <thead><tr><th>القسط</th><th>المبلغ</th><th>تاريخ السداد</th><th>الحالة</th></tr></thead>
    <tbody>${installmentsRows}</tbody>
  </table>

  <div class="footer">
    مرسى — bmarsa.com · تقرير مُولَّد في ${fmtDate(new Date())}
  </div>

  <script>
    window.addEventListener("load", function () {
      // Auto-open the print dialog so admin can save as PDF immediately.
      setTimeout(function () { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("celebration report error", e);
    return new Response(
      JSON.stringify({ error: "فشل توليد التقرير الاحتفالي" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
