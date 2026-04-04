/**
 * Generate printable HTML for a contract with letterhead and margins
 */

export interface ContractPdfOptions {
  finalContent: string;
  templateTitle: string;
  clientName: string;
  letterheadImage?: string | null;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  fontSize?: number;
  textAlign?: string;
  managerSignatureImage?: string | null;
  managerStampImage?: string | null;
  managerName?: string | null;
  signedAt?: string | null;
  managerSignedAt?: string | null;
  clientSignature?: string | null;
  clientSignedAt?: string | null;
  addenda?: { title: string; content: string; createdAt: string }[];
}

export function generateContractHtml(opts: ContractPdfOptions): string {
  const {
    finalContent,
    templateTitle,
    letterheadImage,
    marginTop = 20,
    marginBottom = 20,
    marginLeft = 20,
    marginRight = 20,
    fontSize = 14,
    textAlign = "right",
    managerSignatureImage,
    managerStampImage,
    managerName,
    signedAt,
    managerSignedAt,
    clientSignature,
    clientSignedAt,
    addenda,
  } = opts;

  const addendaHtml = addenda && addenda.length > 0
    ? addenda.map((a, i) => `
      <div class="addendum" style="page-break-before: always;">
        <h2 style="text-align: center; color: #1C1B2E; margin-bottom: 16px;">ملحق رقم ${i + 1}: ${a.title}</h2>
        <div>${a.content}</div>
        <p style="color: #888; font-size: 12px; margin-top: 16px;">تاريخ الإنشاء: ${new Date(a.createdAt).toLocaleDateString("ar-SA")}</p>
      </div>
    `).join("")
    : "";

  const signaturesHtml = (managerSignatureImage || signedAt) ? `
    <div class="signatures" style="display: flex; justify-content: space-between; margin-top: 40px; page-break-inside: avoid;">
      <div style="text-align: center; flex: 1;">
        <p style="font-weight: bold; margin-bottom: 8px;">الطرف الأول</p>
        ${managerName ? `<p>${managerName}</p>` : ""}
        ${managerSignatureImage ? `<img src="${managerSignatureImage}" style="max-height: 80px; margin: 8px auto;" />` : ""}
        ${managerStampImage ? `<img src="${managerStampImage}" style="max-height: 60px; margin: 8px auto;" />` : ""}
        ${managerSignedAt ? `<p style="font-size: 11px; color: #888;">التاريخ: ${new Date(managerSignedAt).toLocaleDateString("ar-SA")}</p>` : ""}
      </div>
      <div style="text-align: center; flex: 1;">
        <p style="font-weight: bold; margin-bottom: 8px;">الطرف الثاني (العميل)</p>
        ${clientSignature ? `<img src="${clientSignature}" style="max-height: 80px; margin: 8px auto;" />` : '<p style="color: #999; font-size: 12px;">لم يتم التوقيع بعد</p>'}
        ${clientSignedAt ? `<p style="font-size: 11px; color: #888;">التاريخ: ${new Date(clientSignedAt).toLocaleDateString("ar-SA")}</p>` : ""}
      </div>
    </div>
  ` : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${templateTitle}</title>
  <style>
    @page {
      size: A4;
      margin: ${marginTop}mm ${marginLeft}mm ${marginBottom}mm ${marginRight}mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: ${fontSize}px;
      line-height: 1.8;
      color: #1a1a1a;
      text-align: ${textAlign};
      direction: rtl;
      margin: 0;
      padding: 0;
    }
    ${letterheadImage ? `
    .letterhead {
      text-align: center;
      margin-bottom: 24px;
    }
    .letterhead img {
      max-width: 100%;
      max-height: 120px;
    }
    ` : ""}
    .contract-content {
      white-space: pre-wrap;
    }
    .contract-content p { margin: 0 0 8px 0; }
    .contract-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
    }
    .contract-content table td,
    .contract-content table th {
      border: 1px solid #ccc;
      padding: 6px 10px;
    }
    .addendum {
      border-top: 2px solid #C9A84C;
      padding-top: 20px;
      margin-top: 20px;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${letterheadImage ? `<div class="letterhead"><img src="${letterheadImage}" alt="ترويسة" /></div>` : ""}
  <div class="contract-content">${finalContent}</div>
  ${signaturesHtml}
  ${addendaHtml}
</body>
</html>`;
}
