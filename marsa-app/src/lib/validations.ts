import { z } from "zod";

export const emailSchema = z.string().email("صيغة البريد الإلكتروني غير صحيحة");

export const phoneSchema = z.string().regex(/^05\d{8}$/, "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام").optional().or(z.literal("")).or(z.null());

export const passwordSchema = z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل");

export const positiveNumber = z.number().positive("يجب أن يكون رقماً موجباً");

export const requiredString = (field: string) => z.string().min(1, `${field} مطلوب`);

// User creation
export const createUserSchema = z.object({
  name: requiredString("الاسم"),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["ADMIN", "MANAGER", "CLIENT", "EXECUTOR", "EXTERNAL_PROVIDER", "FINANCE_MANAGER", "TREASURY_MANAGER"]),
  phone: phoneSchema,
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
