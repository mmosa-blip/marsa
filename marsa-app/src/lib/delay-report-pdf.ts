/**
 * Delay-report PDF exporter.
 *
 * Why not jsPDF + autoTable like exportInvoicePDF?
 *   jsPDF's default font can't render Arabic glyphs, and embedding an
 *   Arabic font (Amiri, NotoSansArabic) blows up the client bundle by
 *   ~500 KB. Since this is an ops-room admin tool used infrequently,
 *   the pragmatic path is to build a printable HTML document and let
 *   the browser's Save-as-PDF flow handle layout + font rendering —
 *   zero new dependencies, perfect Arabic shaping, RTL for free.
 *
 * The helper opens a new window, injects the styled HTML, then calls
 * window.print() once the document has loaded. The user's browser
 * print dialog has a "Save as PDF" destination built in.
 */

export interface DelayReportPeriod {
  id: string;
  reason: string;
  notes: string | null;
  startDate: string;
  endDate: string | null;
  isOpen: boolean;
  days: number;
  pausedBy: { id: string; name: string } | null;
  resumedBy: { id: string; name: string } | null;
}

export interface DelayReportData {
  projectName: string;
  projectCode?: string | null;
  clientName?: string | null;
  departmentName?: string | null;
  startDate: string | null;
  originalEndDate: string | null;
  adjustedEndDate: string | null;
  isPaused: boolean;
  totalPausedDays: number;
  periods: DelayReportPeriod[];
}

function reasonLabel(r: string): string {
  if (r === "PAYMENT_DELAY") return "تأخر الدفعة";
  if (r === "CLIENT_REQUEST") return "طلب العميل";
  if (r === "OTHER") return "أخرى";
  return r;
}

function dateFmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escape(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function exportDelayReportPDF(report: DelayReportData) {
  const today = new Date().toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const summaryRows = [
    { label: "تاريخ بداية المشروع", value: dateFmt(report.startDate) },
    { label: "تاريخ الانتهاء الأصلي", value: dateFmt(report.originalEndDate) },
    { label: "إجمالي أيام الإيقاف", value: `${report.totalPausedDays} يوم` },
    { label: "تاريخ الانتهاء المعدّل", value: dateFmt(report.adjustedEndDate) },
    { label: "الحالة", value: report.isPaused ? "موقوف حالياً" : "نشط" },
  ];

  const hasDelay = report.periods.length > 0 || report.totalPausedDays > 0;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>تقرير التأخير — ${escape(report.projectName)}</title>
  <style>
    @page { size: A4; margin: 18mm 15mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: "Noto Sans Arabic", "Segoe UI", "Tahoma", sans-serif;
      color: #1C1B2E;
      background: #ffffff;
      direction: rtl;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 14px;
      border-bottom: 3px solid #C9A84C;
      margin-bottom: 18px;
    }
    .brand {
      font-size: 28px;
      font-weight: 900;
      color: #C9A84C;
      letter-spacing: 2px;
    }
    .brand-ar { font-size: 13px; color: #5E5495; margin-top: 2px; letter-spacing: 0; font-weight: 700; }
    .header-right { text-align: left; }
    .report-title { font-size: 18px; font-weight: 800; color: #1C1B2E; }
    .report-date { font-size: 11px; color: #6B7280; margin-top: 4px; }
    h2 {
      font-size: 13px;
      color: #5E5495;
      margin: 18px 0 8px 0;
      padding-right: 10px;
      border-right: 4px solid #C9A84C;
    }
    .project-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 20px;
      background: #FAFAF7;
      border: 1px solid #F0EDE6;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .project-info .row { display: flex; align-items: baseline; gap: 6px; }
    .project-info .label { font-size: 10px; color: #6B7280; font-weight: 700; }
    .project-info .value { font-size: 12px; font-weight: 700; color: #1C1B2E; }
    .summary {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px 20px;
      background: #FAFAF7;
      border: 1px solid #F0EDE6;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .summary .row { display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; border-bottom: 1px dashed #E5E4DD; }
    .summary .row:last-child { border-bottom: none; }
    .summary .label { font-size: 11px; color: #6B7280; font-weight: 700; }
    .summary .value { font-size: 12px; font-weight: 800; color: #1C1B2E; }
    .highlight-value { color: #DC2626 !important; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      font-size: 11px;
    }
    thead th {
      background: #1C1B2E;
      color: #ffffff;
      padding: 8px 6px;
      text-align: center;
      font-weight: 700;
      font-size: 11px;
      border: 1px solid #1C1B2E;
    }
    tbody td {
      padding: 7px 6px;
      border: 1px solid #E5E4DD;
      text-align: center;
      vertical-align: middle;
    }
    tbody tr:nth-child(even) td { background: #FAFAF7; }
    .reason-cell { font-weight: 700; color: #1C1B2E; }
    .days-cell { font-weight: 800; color: #DC2626; }
    .notes-cell { text-align: right; font-size: 10px; color: #4B5563; max-width: 120px; word-break: break-word; }
    .empty {
      text-align: center;
      padding: 40px 20px;
      background: rgba(34,197,94,0.06);
      border: 1px solid rgba(34,197,94,0.25);
      border-radius: 10px;
      color: #16A34A;
      font-weight: 800;
      font-size: 14px;
    }
    .conclusion {
      margin-top: 20px;
      padding: 14px 16px;
      background: rgba(201,168,76,0.08);
      border: 1px solid rgba(201,168,76,0.3);
      border-radius: 10px;
      font-size: 13px;
      font-weight: 800;
      color: #1C1B2E;
      text-align: center;
    }
    .footer {
      margin-top: 30px;
      padding-top: 12px;
      border-top: 1px solid #E5E4DD;
      font-size: 9px;
      color: #9CA3AF;
      text-align: center;
    }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">MARSA</div>
      <div class="brand-ar">مرسى — منصة إدارة الأعمال</div>
    </div>
    <div class="header-right">
      <div class="report-title">تقرير التأخير</div>
      <div class="report-date">صادر بتاريخ: ${today}</div>
    </div>
  </div>

  <h2>معلومات المشروع</h2>
  <div class="project-info">
    <div class="row"><span class="label">اسم المشروع:</span><span class="value">${escape(report.projectName)}</span></div>
    <div class="row"><span class="label">رقم المشروع:</span><span class="value">${escape(report.projectCode || "—")}</span></div>
    <div class="row"><span class="label">العميل:</span><span class="value">${escape(report.clientName || "—")}</span></div>
    <div class="row"><span class="label">القسم:</span><span class="value">${escape(report.departmentName || "—")}</span></div>
  </div>

  <h2>الملخص</h2>
  <div class="summary">
    ${summaryRows
      .map(
        (r) => `<div class="row">
          <span class="label">${r.label}</span>
          <span class="value ${r.label === "إجمالي أيام الإيقاف" ? "highlight-value" : ""}">${r.value}</span>
        </div>`
      )
      .join("")}
  </div>

  <h2>فترات الإيقاف</h2>
  ${
    !hasDelay
      ? `<div class="empty">لا يوجد تأخير مسجّل ✓</div>`
      : `<table>
          <thead>
            <tr>
              <th style="width: 32px;">#</th>
              <th>السبب</th>
              <th>تاريخ البداية</th>
              <th>تاريخ الانتهاء</th>
              <th style="width: 60px;">الأيام</th>
              <th>الملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${report.periods
              .map(
                (p, idx) => `<tr>
                  <td>${idx + 1}</td>
                  <td class="reason-cell">${escape(reasonLabel(p.reason))}</td>
                  <td>${escape(dateFmt(p.startDate))}</td>
                  <td>${p.isOpen ? "جارٍ" : escape(dateFmt(p.endDate))}</td>
                  <td class="days-cell">${p.days}</td>
                  <td class="notes-cell">${escape(p.notes || "—")}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
        <div class="conclusion">
          إجمالي التأخير: ${report.totalPausedDays} يوم عمل
        </div>`
  }

  <div class="footer">
    تم إنشاء هذا التقرير تلقائياً بواسطة نظام مرسى لإدارة الأعمال
  </div>

  <script>
    // Give the browser a tick to lay out fonts/images, then pop the
    // print dialog. afterprint closes the tab so the user doesn't
    // have to clean up.
    window.addEventListener("load", function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 250);
    });
    window.addEventListener("afterprint", function () {
      window.close();
    });
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) {
    alert("تعذّر فتح نافذة التصدير — تحقق من إعدادات المتصفح ومنع النوافذ المنبثقة");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
