import { z } from "zod";

export const emailSchema = z.string().email("صيغة البريد الإلكتروني غير صحيحة").optional().or(z.literal("")).or(z.null());

// Phone schemas normalize every number to canonical E.164 ("+CCxxxxxxx").
// Saudi numbers are auto-prefixed with +966; any other international
// number is kept as-is once the leading "+" is resolved.
export const phoneAuthSchema = z.string()
  .transform((val) => normalizePhone(val))
  .refine((val) => isValidPhone(val), "رقم الجوال غير صالح — أدخل رقماً بصيغة دولية يبدأ بـ + ورمز الدولة");

export const phoneSchema = z.string()
  .transform((val) => (val ? normalizePhone(val) : val))
  .refine((val) => !val || isValidPhone(val), "رقم الجوال غير صالح — أدخل رقماً بصيغة دولية يبدأ بـ + ورمز الدولة")
  .optional()
  .or(z.literal(""))
  .or(z.null());

export const passwordSchema = z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل");

export const positiveNumber = z.number().positive("يجب أن يكون رقماً موجباً");

export const requiredString = (field: string) => z.string().min(1, `${field} مطلوب`);

/**
 * Normalize any phone input to canonical E.164 ("+CCxxxxxxxxx").
 *
 * Rules (in order):
 *   • strip spaces, dashes, parentheses
 *   • leading "00" (international access code) → "+"
 *   • leading "05"  → "+966" + the 9 digits after the 0 (Saudi)
 *   • leading "5" with 9 digits total → "+9665xxxxxxxx" (Saudi)
 *   • leading "+"  → keep as-is
 *   • bare digits starting with "966" → "+" prefix
 *   • anything else → returned unchanged so the validator can reject it
 */
export function normalizePhone(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/[\s\-()]/g, "");

  // 00XXXXX → +XXXXX
  if (cleaned.startsWith("00")) cleaned = "+" + cleaned.slice(2);

  // Saudi shortcuts: +966xxxxxxxxx أو +1xxxxxxxxxx (local 0- or 5-prefixed Saudi inputs are promoted to +9665xxxxxxxx)
  if (/^05\d{8}$/.test(cleaned)) return "+966" + cleaned.slice(1);
  if (/^5\d{8}$/.test(cleaned)) return "+966" + cleaned;

  // Already E.164 — trust it.
  if (cleaned.startsWith("+")) return cleaned;

  // Bare digits starting with the Saudi country code — prepend "+".
  if (/^966\d{9}$/.test(cleaned)) return "+" + cleaned;

  // Any other bare international digits 8–15 long — prepend "+".
  if (/^\d{8,15}$/.test(cleaned)) return "+" + cleaned;

  return cleaned;
}

/**
 * Validate a phone number as canonical E.164:
 *   +[1-9] followed by 7–14 more digits (8–15 digits total after "+").
 */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^\+[1-9]\d{7,14}$/.test(normalized);
}

// ── Legacy aliases (kept so existing imports continue to compile) ──
// They now accept international numbers too, not only Saudi ones.
export const normalizeSaudiPhone = normalizePhone;
export const isValidSaudiPhone = isValidPhone;

// User creation
export const createUserSchema = z.object({
  name: requiredString("الاسم"),
  phone: z.string().min(1, "رقم الجوال مطلوب"),
  password: passwordSchema,
  role: z.enum(["ADMIN", "MANAGER", "CLIENT", "EXECUTOR", "BRANCH_MANAGER", "EXTERNAL_PROVIDER", "FINANCE_MANAGER", "TREASURY_MANAGER"]),
  email: emailSchema,
  specialization: z.string().optional(),
  costPerTask: z.number().optional(),
  bankName: z.string().optional(),
  bankIban: z.string().optional(),
  supervisorId: z.string().optional(),
  supervisorUserId: z.string().optional(),
  companyName: z.string().optional(),
  commercialRegister: z.string().optional(),
  sector: z.string().optional(),
});

// Profile update
export const updateProfileSchema = z.object({
  name: requiredString("الاسم"),
  phone: phoneSchema,
  avatar: z.string().optional(),
});

// Change password
export const changePasswordSchema = z.object({
  currentPassword: requiredString("كلمة المرور الحالية"),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "كلمة المرور الجديدة غير متطابقة",
  path: ["confirmPassword"],
});

// Settings
export const updateSettingsSchema = z.record(z.string(), z.string());

// Service provider mapping
export const createMappingSchema = z.object({
  serviceTemplateId: requiredString("الخدمة"),
  providerId: requiredString("المزود"),
  priority: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

// Task rejection
export const taskRejectionSchema = z.object({
  reason: requiredString("سبب الرفض"),
});

// Task transfer
export const taskTransferSchema = z.object({
  targetUserId: requiredString("المستخدم المستهدف"),
  reason: requiredString("سبب التحويل"),
  urgency: z.enum(["NORMAL", "URGENT"]).optional().default("NORMAL"),
});
