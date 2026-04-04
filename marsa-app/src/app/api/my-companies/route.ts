import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "CLIENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const companies = await prisma.company.findMany({
      where: { ownerId: session.user.id },
      select: { id: true, name: true, commercialRegister: true, sector: true },
    });
    return NextResponse.json(companies);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "CLIENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const body = await request.json();
    if (!body.name) {
      return NextResponse.json({ error: "اسم الشركة مطلوب" }, { status: 400 });
    }
    const company = await prisma.company.create({
      data: {
        name: body.name,
        commercialRegister: body.commercialRegister || null,
        sector: body.sector || null,
        ownerId: session.user.id,
      },
    });
    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
