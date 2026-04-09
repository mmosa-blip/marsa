import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";

// GET — download Excel template for client import
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const wb = XLSX.utils.book_new();

    // Header row
    const headers = [
      "الاسم الكامل *",
      "رقم الجوال *",
      "البريد الإلكتروني",
      "اسم الشركة",
      "السجل التجاري",
      "القطاع",
      "ملاحظات",
    ];

    // Sample data rows
    const sampleData = [
      ["أحمد محمد العلي", "0512345678", "ahmed@example.com", "شركة النور للتجارة", "1234567890", "تجارة", "عميل VIP"],
      ["سارة عبدالله الحربي", "0598765432", "", "مؤسسة السارة", "", "خدمات", ""],
      ["خالد إبراهيم", "0555123456", "khalid@test.com", "", "", "", ""],
    ];

    const wsData = [headers, ...sampleData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws["!cols"] = [
      { wch: 25 }, // الاسم
      { wch: 15 }, // الجوال
      { wch: 25 }, // البريد
      { wch: 25 }, // الشركة
      { wch: 15 }, // السجل
      { wch: 15 }, // القطاع
      { wch: 30 }, // ملاحظات
    ];

    XLSX.utils.book_append_sheet(wb, ws, "العملاء");

    // Instructions sheet
    const instrData = [
      ["دليل استيراد العملاء"],
      [""],
      ["الحقول المطلوبة:"],
      ["- الاسم الكامل: اسم العميل (مطلوب)"],
      ["- رقم الجوال: +966xxxxxxxxx أو +1xxxxxxxxxx (مطلوب، يجب أن يكون فريداً)"],
      [""],
      ["الحقول الاختيارية:"],
      ["- البريد الإلكتروني: بريد العميل"],
      ["- اسم الشركة: اسم الشركة أو المؤسسة"],
      ["- السجل التجاري: رقم السجل التجاري"],
      ["- القطاع: قطاع العمل"],
      ["- ملاحظات: أي ملاحظات إضافية"],
      [""],
      ["ملاحظات مهمة:"],
      ["- لا تحذف أو تغير صف العناوين"],
      ["- أرقام الجوال المكررة سيتم تجاهلها"],
      ["- كلمة المرور الافتراضية: Marsa@2026"],
      ["- يمكنك حذف صفوف الأمثلة قبل الاستيراد"],
    ];
    const instrWs = XLSX.utils.aoa_to_sheet(instrData);
    instrWs["!cols"] = [{ wch: 60 }];
    XLSX.utils.book_append_sheet(wb, instrWs, "التعليمات");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=marsa_clients_template.xlsx",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
