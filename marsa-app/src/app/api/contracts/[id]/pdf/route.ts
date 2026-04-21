import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();

    const { id } = await params;
    const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        template: true,
        client: true,
        issuedBy: true,
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "العقد غير موجود" }, { status: 404 });
    }

    if (!isAdmin && contract.clientId !== session.user.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    direction: rtl;
    font-family: 'Cairo', 'Arial', sans-serif;
    background: white;
  }

  /* ── Letterhead background on the wrapper ── */
  .page-wrapper {
    ${contract.template?.letterheadImage
      ? `background-image: url('${contract.template.letterheadImage}');`
      : ''}
    background-size: 210mm 297mm;
    background-repeat: repeat-y;
    background-position: top center;
    width: 210mm;
    margin: 0 auto;
  }

  /* ── TABLE SPACER HACK for reliable top/bottom margins every page ── */
  .layout-table {
    width: 100%;
    border-collapse: collapse;
  }

  .layout-table thead td,
  .layout-table tfoot td {
    padding: 0;
  }

  .spacer-top    { height: 36mm; display: block; }
  .spacer-bottom { height: 40mm; display: block; }

  /* ── Contract text ── */
  .contract-number {
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    color: #444;
    margin-bottom: 6mm;
  }

  .contract-text {
    font-size: ${contract.template?.fontSize || 14}px;
    line-height: 2;
    color: #1a1a1a;
    padding-left: 17.5mm;
    padding-right: 17.5mm;
    white-space: pre-wrap;
  }

  /* Preserve WYSIWYG HTML formatting */
  .contract-text p      { margin-bottom: 1rem; line-height: 2; text-align: justify; }
  .contract-text h1     { font-size: 1.8em; font-weight: 700; margin: 0.6em 0; }
  .contract-text h2     { font-size: 1.4em; font-weight: 700; margin: 0.5em 0; }
  .contract-text h3     { font-size: 1.2em; font-weight: 700; margin: 0.4em 0; }
  .contract-text strong,
  .contract-text b      { font-weight: 700; }
  .contract-text em,
  .contract-text i      { font-style: italic; }
  .contract-text u      { text-decoration: underline; }
  .contract-text ul     { list-style: disc;    padding-right: 24px; margin: 0.5em 0; }
  .contract-text ol     { list-style: decimal; padding-right: 24px; margin: 0.5em 0; }
  .contract-text li     { margin: 0.3em 0; line-height: 1.8; }
  .contract-text table  { width: 100%; border-collapse: collapse; margin: 1em 0; }
  .contract-text td,
  .contract-text th     { border: 1px solid #ccc; padding: 8px; }
  .contract-text .ql-align-center  { text-align: center !important; }
  .contract-text .ql-align-right   { text-align: right  !important; }
  .contract-text .ql-align-left    { text-align: left   !important; }
  .contract-text .ql-align-justify { text-align: justify !important; }

  /* ── Signatures ── */
  .signature-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 20px;
    margin-top: 16mm;
    padding-left: 17.5mm;
    padding-right: 17.5mm;
  }

  .sig-box { flex: 1; text-align: center; border-top: 1px solid #333; padding-top: 8px; }
  .sig-box img  { max-width: 150px; max-height: 75px; display: block; margin: 0 auto 6px; }
  .sig-stamp    { max-width: 85px;  max-height: 85px;  display: block; margin: 0 auto 4px; }
  .sig-label    { font-size: 13px; font-weight: 700; color: #1a1a1a; margin-bottom: 3px; }
  .sig-date     { font-size: 12px; color: #555; }

  /* ── PRINT RULES ── */
  @media print {
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    @page {
      size: A4;
      margin: 0mm !important;
    }

    html, body { margin: 0; padding: 0; }

    .page-wrapper {
      ${contract.template?.letterheadImage
        ? `background-image: url('${contract.template.letterheadImage}') !important;`
        : ''}
      background-size: 210mm 297mm !important;
      background-repeat: repeat-y !important;
      background-position: top center !important;
    }

    .contract-text p {
      margin-bottom: 1rem !important;
      page-break-inside: avoid;
    }

    p, li, tr, .contract-text h1,
    .contract-text h2, .contract-text h3 {
      page-break-inside: avoid;
    }

    .signature-section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page-wrapper">

  <table class="layout-table">
    <thead>
      <tr><td><div class="spacer-top"></div></td></tr>
    </thead>
    <tbody>
      <tr><td>
        <div class="contract-number">
          ${contract.contractNumber ? `عقد رقم: ${contract.contractNumber}` : ''}
        </div>
        <div class="contract-text">
          ${contract.finalContent || ''}
        </div>
        <div class="signature-section">
          <div class="sig-box">
            ${contract.managerStampImage
              ? `<img class="sig-stamp" src="${contract.managerStampImage}" />`
              : ''}
            ${contract.managerSignatureImage
              ? `<img src="${contract.managerSignatureImage}" />`
              : '<div style="height:75px;"></div>'}
            <div class="sig-label">${contract.managerName || 'المدير المفوض'}</div>
            <div class="sig-date">${contract.managerSignedAt
              ? new Date(contract.managerSignedAt).toLocaleDateString('ar-SA')
              : ''}</div>
            <div class="sig-label" style="margin-top:6px;">توقيع الشركة</div>
          </div>
          <div class="sig-box">
            ${contract.clientSignature
              ? `<img src="${contract.clientSignature}" />`
              : contract.client?.signatureImage
                ? `<img src="${contract.client.signatureImage}" />`
                : '<div style="height:75px;"></div>'}
            <div class="sig-label">${contract.client?.name || ''}</div>
            <div class="sig-date">${contract.clientSignedAt
              ? new Date(contract.clientSignedAt).toLocaleDateString('ar-SA')
              : contract.signedAt
                ? new Date(contract.signedAt).toLocaleDateString('ar-SA')
                : ''}</div>
            <div class="sig-label" style="margin-top:6px;">توقيع العميل</div>
          </div>
        </div>
      </td></tr>
    </tbody>
    <tfoot>
      <tr><td><div class="spacer-bottom"></div></td></tr>
    </tfoot>
  </table>

</div>
<script>
  window.onload = () => setTimeout(() => window.print(), 900);
</script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="contract-${contract.contractNumber || id}.html"`,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error generating contract PDF:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
