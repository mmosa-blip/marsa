/**
 * "لماذا X يوم؟" — Duration breakdown PDF exporter.
 *
 * Same print-window technique as delay-report-pdf.ts: builds an
 * A4-ready Arabic RTL HTML document and triggers window.print() so
 * the browser's built-in Save-as-PDF renders everything natively.
 */

export interface DurationTask {
  name: string;
  defaultDuration: number;
  executionMode: string;
  sameDay: boolean;
}

export interface DurationService {
  name: string;
  executionMode: string;
  duration: number;
  addsToTotal: boolean;
  tasks: DurationTask[];
}

export interface DurationReportData {
  templateName: string;
  totalDays: number;
  workflowType: string;
  services: DurationService[];
}

function escape(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function modeLabel(m: string, sameDay?: boolean): string {
  if (sameDay) return "نفس اليوم";
  if (m === "PARALLEL") return "توازي";
  if (m === "INDEPENDENT") return "مستقل";
  return "تسلسلي";
}

function modeColor(m: string, sameDay?: boolean): string {
  if (sameDay) return "#92400E";
  if (m === "PARALLEL") return "#2563EB";
  if (m === "INDEPENDENT") return "#6B7280";
  return "#C9A84C";
}

export function exportDurationReportPDF(report: DurationReportData) {
  const today = new Date().toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const addingSvcs = report.services.filter((s) => s.addsToTotal);

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>تقرير المدة الزمنية — ${escape(report.templateName)}</title>
  <style>
    @page { size: A4; margin: 18mm 15mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: "Noto Sans Arabic", "Segoe UI", "Tahoma", sans-serif;
      color: #1C1B2E; background: #fff; direction: rtl;
    }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 14px; border-bottom: 3px solid #C9A84C; margin-bottom: 18px;
    }
    .brand { font-size: 28px; font-weight: 900; color: #C9A84C; letter-spacing: 2px; }
    .brand-ar { font-size: 13px; color: #5E5495; margin-top: 2px; font-weight: 700; }
    .header-right { text-align: left; }
    .report-title { font-size: 18px; font-weight: 800; }
    .report-date { font-size: 11px; color: #6B7280; margin-top: 4px; }
    h2 {
      font-size: 13px; color: #5E5495; margin: 18px 0 8px 0;
      padding-right: 10px; border-right: 4px solid #C9A84C;
    }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead th {
      background: #1C1B2E; color: #fff; padding: 8px 6px;
      text-align: center; font-weight: 700; border: 1px solid #1C1B2E;
    }
    tbody td {
      padding: 7px 6px; border: 1px solid #E5E4DD;
      text-align: center; vertical-align: middle;
    }
    tbody tr:nth-child(even) td { background: #FAFAF7; }
    .svc-row td { font-weight: 700; background: #F0EDE6 !important; }
    .task-row td { font-weight: 400; font-size: 10px; color: #4B5563; }
    .task-row td:first-child { padding-right: 24px; text-align: right; }
    .mode-badge {
      display: inline-block; font-size: 9px; font-weight: 700;
      padding: 2px 6px; border-radius: 8px;
    }
    .adds-yes { color: #16A34A; font-weight: 800; }
    .adds-no { color: #9CA3AF; }
    .conclusion {
      margin-top: 20px; padding: 14px 16px;
      background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.3);
      border-radius: 10px; font-size: 13px; font-weight: 800;
      text-align: center; color: #1C1B2E;
    }
    .note { font-size: 10px; color: #6B7280; margin-top: 6px; text-align: center; }
    .footer {
      margin-top: 30px; padding-top: 12px; border-top: 1px solid #E5E4DD;
      font-size: 9px; color: #9CA3AF; text-align: center;
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
      <div class="report-title">تقرير المدة الزمنية</div>
      <div class="report-date">صادر بتاريخ: ${today}</div>
    </div>
  </div>

  <h2>قالب: ${escape(report.templateName)}</h2>

  <table>
    <thead>
      <tr>
        <th style="text-align:right;">الخدمة / المهمة</th>
        <th>النوع</th>
        <th style="width:60px;">الأيام</th>
        <th style="width:60px;">تُضاف؟</th>
      </tr>
    </thead>
    <tbody>
      ${report.services
        .map(
          (svc) => {
            const mc = modeColor(svc.executionMode);
            const svcRow = `<tr class="svc-row">
              <td style="text-align:right;">${escape(svc.name)}</td>
              <td><span class="mode-badge" style="background:${mc}18;color:${mc};">${modeLabel(svc.executionMode)}</span></td>
              <td>${svc.duration}</td>
              <td class="${svc.addsToTotal ? "adds-yes" : "adds-no"}">${svc.addsToTotal ? "✅ نعم" : "—"}</td>
            </tr>`;
            const taskRows = svc.tasks
              .map(
                (t, i) => {
                  const tc = modeColor(t.executionMode, t.sameDay);
                  return `<tr class="task-row">
                    <td>${i + 1}. ${escape(t.name)}</td>
                    <td><span class="mode-badge" style="background:${tc}15;color:${tc};">${modeLabel(t.executionMode, t.sameDay)}</span></td>
                    <td>${t.sameDay ? "0" : t.defaultDuration}</td>
                    <td></td>
                  </tr>`;
                }
              )
              .join("");
            return svcRow + taskRows;
          }
        )
        .join("")}
    </tbody>
  </table>

  <div class="conclusion">
    المجموع = ${addingSvcs.map((s) => s.duration).join(" + ")} = ${report.totalDays} يوم عمل
  </div>
  <p class="note">
    الخدمات التوازية والمستقلة تعمل بالتوازي مع غيرها ولا تُضاف للمجموع
  </p>

  <div class="footer">
    تم إنشاء هذا التقرير تلقائياً بواسطة نظام مرسى لإدارة الأعمال
  </div>

  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
    });
    window.addEventListener("afterprint", function () { window.close(); });
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) {
    alert("تعذّر فتح نافذة التصدير — تحقق من إعدادات منع النوافذ المنبثقة");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
