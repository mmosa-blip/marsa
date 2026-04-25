import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { createAuditLog, AuditModule } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { countWorkingDays } from "@/lib/working-days";

// GET /api/projects/[id]/celebration/image
//
// Returns a 1200x630 PNG suitable for sharing on WhatsApp/Twitter — a
// completion-celebration card for a COMPLETED project. The image is
// generated on-demand (never persisted) so admins can re-pull it any
// time the project name or client name changes.
//
// Auth: ADMIN / MANAGER. The project must have status = COMPLETED;
// other statuses get 409 with a hint.

export const runtime = "nodejs";

async function loadFonts(req: NextRequest) {
  const [regular, bold] = await Promise.all([
    fetch(new URL("/fonts/Tajawal-Regular.ttf", req.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("/fonts/Tajawal-Bold.ttf", req.url)).then((r) => r.arrayBuffer()),
  ]);
  return { regular, bold };
}

function formatHijri(d: Date): string {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}

function formatGregorian(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

export async function GET(
  req: NextRequest,
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
        status: true,
        startDate: true,
        closedAt: true,
        updatedAt: true,
        client: { select: { name: true } },
      },
    });

    if (!project || project.status === "CANCELLED") {
      return new Response(
        JSON.stringify({ error: "المشروع غير موجود" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (project.status !== "COMPLETED") {
      return new Response(
        JSON.stringify({
          error: "البطاقة الاحتفالية متاحة فقط للمشاريع المكتملة",
          status: project.status,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Closed-at falls back to updatedAt if the project was marked
    // COMPLETED without populating closedAt (older rows may lack it).
    const completedDate = project.closedAt ?? project.updatedAt;
    const workingDays =
      project.startDate && completedDate
        ? countWorkingDays(project.startDate, completedDate)
        : null;

    const { regular, bold } = await loadFonts(req);

    const clientName = project.client?.name ?? "العميل الكريم";
    const projectName = project.name;

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
      meta: { type: "image" },
    });

    return new ImageResponse(
      (
        <div
          dir="rtl"
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #1B2A4A 0%, #5E5495 55%, #C9A84C 100%)",
            color: "#FFFFFF",
            fontFamily: "Tajawal",
            padding: "60px",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 36,
              right: 60,
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: 2,
              opacity: 0.9,
            }}
          >
            مرسى
          </div>

          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              marginBottom: 8,
              display: "flex",
            }}
          >
            🎉 تهانينا
          </div>

          <div
            style={{
              fontSize: 38,
              opacity: 0.95,
              marginBottom: 26,
              display: "flex",
            }}
          >
            السيد/ة {clientName}
          </div>

          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              marginBottom: 22,
              maxWidth: 1000,
              textAlign: "center",
              display: "flex",
            }}
          >
            تم إنجاز مشروع: {projectName}
          </div>

          {workingDays !== null && (
            <div
              style={{
                fontSize: 26,
                background: "rgba(255,255,255,0.15)",
                padding: "10px 26px",
                borderRadius: 999,
                marginBottom: 28,
                display: "flex",
              }}
            >
              في {workingDays} يوم عمل
            </div>
          )}

          <div
            style={{
              fontSize: 22,
              opacity: 0.85,
              marginBottom: 6,
              display: "flex",
            }}
          >
            {formatGregorian(completedDate)}
          </div>
          {formatHijri(completedDate) && (
            <div
              style={{
                fontSize: 20,
                opacity: 0.75,
                marginBottom: 28,
                display: "flex",
              }}
            >
              {formatHijri(completedDate)}
            </div>
          )}

          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              marginTop: 10,
              display: "flex",
            }}
          >
            نشكركم على ثقتكم
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 28,
              fontSize: 18,
              opacity: 0.7,
              display: "flex",
            }}
          >
            bmarsa.com
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: "Tajawal", data: regular, weight: 400, style: "normal" },
          { name: "Tajawal", data: bold, weight: 700, style: "normal" },
        ],
      }
    );
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("celebration image error", e);
    return new Response(
      JSON.stringify({ error: "فشل توليد الصورة الاحتفالية" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
