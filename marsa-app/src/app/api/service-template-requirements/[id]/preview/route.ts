import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { previewRequirementSync } from "@/lib/template-sync";

// GET /api/service-template-requirements/[id]/preview?action=create|update|delete
//
// Read-only preview the editor calls before showing the
// "this will affect N projects" confirmation modal.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const { id } = await params;
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "update";
    if (!["create", "update", "delete"].includes(action)) {
      return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
    }
    const summary = await previewRequirementSync(id, action as "create" | "update" | "delete");
    return NextResponse.json(summary);
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("preview GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
