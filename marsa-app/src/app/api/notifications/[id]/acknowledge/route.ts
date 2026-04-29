import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/notifications/[id]/acknowledge
 *
 * Records the recipient's "استلمت" click for a mandatory-ack
 * notification (e.g. PROJECT_ASSIGNED). Sets `acknowledgedAt = now()`
 * and `isRead = true` in one update so the bell counter and the modal
 * queue both clear together.
 *
 * Authorisation: the recipient owns the notification — anyone else
 * (including admins) gets 403. There is no "ack on behalf of".
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;

    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, acknowledgedAt: true },
    });

    if (!notification) {
      return NextResponse.json({ error: "الإشعار غير موجود" }, { status: 404 });
    }

    if (notification.userId !== session.user.id) {
      return NextResponse.json(
        { error: "غير مصرح بالوصول لهذا الإشعار" },
        { status: 403 }
      );
    }

    // Idempotent: re-acknowledging is a no-op so duplicate clicks from a
    // flaky network never produce a 500. The first stamp wins.
    if (notification.acknowledgedAt) {
      return NextResponse.json({ success: true, alreadyAcknowledged: true });
    }

    await prisma.notification.update({
      where: { id },
      data: { acknowledgedAt: new Date(), isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error acknowledging notification:", error);
    return NextResponse.json(
      { error: "حدث خطأ في تأكيد الاستلام" },
      { status: 500 }
    );
  }
}
