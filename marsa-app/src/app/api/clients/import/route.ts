import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeSaudiPhone, isValidSaudiPhone } from "@/lib/validations";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";

const DEFAULT_PASSWORD = "Marsa@2026";

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: { row: number; name: string; reason: string }[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "الملف مطلوب" }, { status: 400 });
    }

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];

    if (!ws) {
      return NextResponse.json({ error: "الملف فارغ أو غير صالح" }, { status: 400 });
    }

    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    if (rows.length === 0) {
      return NextResponse.json({ error: "لا توجد بيانات في الملف" }, { status: 400 });
    }

    // Hash the default password once
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);

    const result: ImportResult = { total: rows.length, imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is header, data starts at row 2

      // Map Arabic headers to fields
      const name = (row["الاسم الكامل *"] || row["الاسم الكامل"] || row["الاسم"] || "").toString().trim();
      const phoneRaw = (row["رقم الجوال *"] || row["رقم الجوال"] || row["الجوال"] || "").toString().trim();
      const email = (row["البريد الإلكتروني"] || row["البريد"] || "").toString().trim();
      const companyName = (row["اسم الشركة"] || row["الشركة"] || "").toString().trim();
      const commercialRegister = (row["السجل التجاري"] || "").toString().trim();
      const sector = (row["القطاع"] || "").toString().trim();

      // Validate required fields
      if (!name) {
        result.errors.push({ row: rowNum, name: name || `صف ${rowNum}`, reason: "الاسم مطلوب" });
        result.skipped++;
        continue;
      }

      if (!phoneRaw) {
        result.errors.push({ row: rowNum, name, reason: "رقم الجوال مطلوب" });
        result.skipped++;
        continue;
      }

      const phone = normalizeSaudiPhone(phoneRaw);
      if (!isValidSaudiPhone(phone)) {
        result.errors.push({ row: rowNum, name, reason: `رقم الجوال غير صحيح: ${phoneRaw}` });
        result.skipped++;
        continue;
      }

      // Check duplicate phone
      const existing = await prisma.user.findUnique({ where: { phone } });
      if (existing) {
        result.errors.push({ row: rowNum, name, reason: `رقم الجوال مسجل مسبقاً: ${phone}` });
        result.skipped++;
        continue;
      }

      try {
        // Create user
        const user = await prisma.user.create({
          data: {
            name,
            phone,
            email: email || null,
            password: hashedPassword,
            role: "CLIENT",
          },
        });

        // Create company if provided
        if (companyName) {
          await prisma.company.create({
            data: {
              name: companyName,
              ownerId: user.id,
              commercialRegister: commercialRegister || null,
              sector: sector || null,
            },
          });
        }

        result.imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "خطأ غير معروف";
        result.errors.push({ row: rowNum, name, reason: msg });
        result.skipped++;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Import error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ error: `خطأ في استيراد الملف: ${msg}` }, { status: 500 });
  }
}
