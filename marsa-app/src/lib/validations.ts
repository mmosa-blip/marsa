import { z } from "zod";

export const emailSchema = z.string().email("صيغة البريد الإلكتروني غير صحيحة").optional().or(z.literal("")).or(z.null());

// Phone schemas accept EITHER a Saudi local number (05xxxxxxxx) or any
// international E.164 number (+CCxxxxxxxxxx). Saudi numbers stay in the
// 05xxxxxxxx shape so existing DB rows keep matching; every other country
// is stored in E.164 so the country code is preserved.
export const phoneAuthSchema = z.string()
  .transform((val) => normalizePhone(val))
  .refine((val) => isValidPhone(val), "رقم الجوال غير صالح — أدخل رقماً سعودياً (05xxxxxxxx) أو دولياً بصيغة +رمز الدولة متبوعاً بالرقم");

export const phoneSchema = z.string()
  .transform((val) => (val ? normalizePhone(val) : val))
  .refine((val) => !val || isValidPhone(val), "رقم الجوال غير صالح — أدخل رقماً سعودياً (05xxxxxxxx) أو دولياً بصيغة +رمز الدولة متبوعاً بالرقم")
  .optional()
  .or(z.literal(""))
  .or(z.null());

export const passwordSchema = z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل");

export const positiveNumber = z.number().positive("يجب أن يكون رقماً موجباً");

export const requiredString = (field: string) => z.string().min(1, `${field} مطلوب`);

/**
 * Normalize a phone number to a canonical form.
 *
 * • Saudi numbers collapse to the local "05xxxxxxxx" shape (preserves
 *   the format that existing User rows were saved with, so login and
 *   uniqueness lookups keep working after this function was widened to
 *   accept non-Saudi input).
 * • Any other international number is returned in E.164 format
 *   "+CCxxxxxxxxx" (8–15 digits after the +).
 * • Cleans whitespace, dashes, parentheses, and converts a leading
 *   "00" international access code to "+".
 *
 * Accepts any of these Saudi inputs:
 *   +9665xxxxxxxx, 009665xxxxxxxx, 9665xxxxxxxx, 05xxxxxxxx, 5xxxxxxxx
 * Accepts any international input shaped as:
 *   +CCxxxxxxxxx (preferred)  or  00CCxxxxxxxxx  or  CCxxxxxxxxx
 */
export function normalizePhone(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/[\s\-()]/g, "");
  // "00" is the international access code in many regions — fold it into "+".
  if (cleaned.startsWith("00")) cleaned = "+" + cleaned.slice(2);

  // ── Saudi Arabia → collapse to the local 05xxxxxxxx format ──
  if (cleaned.startsWith("+966")) {
    const rest = cleaned.slice(4);
    if (/^5\d{8}$/.test(rest)) return "0" + rest;
  }
  if (cleaned.startsWith("966") && /^9665\d{8}$/.test(cleaned)) {
    return "0" + cleaned.slice(3);
  }
  if (/^05\d{8}$/.test(cleaned)) return cleaned;
  if (/^5\d{8}$/.test(cleaned)) return "0" + cleaned;

  // ── Everything else → E.164. If the caller gave us the digits with a
  //    country code but no "+", add one (the ambiguity of "starts with
  //    a country-code digit" is acceptable here because Saudi was
  //    already handled above).
  if (cleaned.startsWith("+")) return cleaned;
  if (/^\d{8,15}$/.test(cleaned)) return "+" + cleaned;
  return cleaned;
}

/**
 * Validate a phone number: Saudi local (05xxxxxxxx) OR E.164
 * (+CCxxxxxxxxx, 8–15 digits total after the +).
 */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  if (/^05\d{8}$/.test(normalized)) return true;
  // E.164: + followed by 8–15 digits, leading digit non-zero.
  if (/^\+[1-9]\d{7,14}$/.test(normalized)) return true;
  return false;
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
  role: z.enum(["ADMIN", "MANAGER", "CLIENT", "EXECUTOR", "EXTERNAL_PROVIDER", "FINANCE_MANAGER", "TREASURY_MANAGER"]),
  email: emailSchema,
  specialization: z.string().optional(),
  costPerTask: z.number().optional(),
  bankName: z.string().optional(),
  bankIban: z.string().optional(),
  supervisorId: z.string().optional(),
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
