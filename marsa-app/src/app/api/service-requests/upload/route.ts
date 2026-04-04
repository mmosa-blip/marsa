import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "لا يوجد ملف" }, { status: 400 });

    const response = await utapi.uploadFiles(file);
    if (response.error) throw new Error(response.error.message);

    return NextResponse.json({ url: response.data.ufsUrl });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء رفع الملف" }, { status: 500 });
  }
}
