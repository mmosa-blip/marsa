// Static set of onboarding tips appended to the rich PROJECT_ASSIGNED
// notification. Kept in code (not DB) because the list rarely changes
// and is shared verbatim across every assignment.
export const PROJECT_ASSIGNMENT_TIPS = [
  "ابدأ بمراجعة متطلبات المهمة الأولى",
  "تواصل مع العميل خلال أول 48 ساعة",
  "وثّق كل خطوة في النظام",
  "راجع المراحل المرتبطة بالأقساط",
  "اطلب إمهالاً مسبقاً إن توقّعت تأخيراً في دفعة",
] as const;

export function projectAssignedMessage(opts: {
  projectName: string;
  projectCode: string | null;
  clientName: string | null;
  startDate: Date | null;
  endDate: Date | null;
  taskCount: number;
}): string {
  const lines: string[] = [];
  lines.push(`تم إسناد مشروع جديد: ${opts.projectName}`);
  if (opts.projectCode) lines.push(`الرمز: ${opts.projectCode}`);
  if (opts.clientName) lines.push(`العميل: ${opts.clientName}`);
  if (opts.startDate) {
    lines.push(`البدء: ${new Date(opts.startDate).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric" })}`);
  }
  if (opts.endDate) {
    const remaining = Math.max(
      0,
      Math.ceil((new Date(opts.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
    lines.push(`المتبقي على نهاية العقد: ${remaining} يوم`);
  }
  lines.push(`عدد المهام المسندة لك: ${opts.taskCount}`);
  lines.push("");
  lines.push("نصائح للبدء:");
  for (const tip of PROJECT_ASSIGNMENT_TIPS) lines.push(`• ${tip}`);
  return lines.join("\n");
}
