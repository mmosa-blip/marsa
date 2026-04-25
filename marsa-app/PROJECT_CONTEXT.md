# PROJECT_CONTEXT.md

ملخص شامل لمشروع مرسى — آخر تحديث: 2026-04-19

---

## 1. نظرة عامة

**اسم المشروع:** مرسى (MARSA)
**الهدف:** منصة إدارة أعمال شاملة لاستشارية سعودية. تُمركز إدارة العملاء، المشاريع، العقود، المهام، المالية، المستندات، والعمليات عبر أقسام متعددة — مع قسم "الاستثمار" الذي يملك منطق توزيع مهام وإدارة مستندات خاص.

**التقنيات الأساسية:**
- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Prisma 7** مع **PostgreSQL** (Supabase — pgbouncer pooler على port 6543، direct على 5432 للـ DDL)
- **NextAuth v4** (مصادقة بالهاتف السعودي/الدولي — E.164)
- **Tailwind v4** + **Tajawal** (خط عربي)
- **Pusher** (إشعارات لحظية)
- **UploadThing** (رفع ملفات — pdf/jpg/png)
- **jsPDF + jspdf-autotable** (تصدير PDF)
- **XLSX** (استيراد/تصدير Excel)
- **النشر:** Vercel (auto-deploy on push to main)
- **URL:** marsa-delta.vercel.app

---

## 2. الأدوار (8 أدوار)

| الدور | الوصف | القائمة الجانبية |
|---|---|---|
| `ADMIN` | مدير النظام — كل الصلاحيات | adminGroups (كاملة) |
| `MANAGER` | مشرف — كل الصلاحيات | adminGroups (كاملة) |
| `BRANCH_MANAGER` | مدير فرع — يشرف على مجموعة منفذين | branchManagerGroups (فريقي + مدينتي) |
| `EXECUTOR` | منفذ — ينفذ المهام + ينشئ مشاريع | executorGroups (مدينتي + مشاريعي) |
| `EXTERNAL_PROVIDER` | مقدم خدمة خارجي | providerGroups (مهامي) |
| `CLIENT` | عميل | clientGroups (مشاريعي + خدماتي) |
| `FINANCE_MANAGER` | مدير مالي | adminGroups |
| `TREASURY_MANAGER` | أمين صندوق | adminGroups |

---

## 3. الهيكل المعماري

### 3.1 قاعدة البيانات (Prisma Schema)
- **73 model** + **45 enum**
- المخرجات تُولّد إلى `src/generated/prisma/`
- الاتصال عبر `PrismaPg` adapter (ليس Prisma الداخلي)
- Singleton proxy في `src/lib/prisma.ts`
- **Soft delete:** `deletedAt + isActive` على معظم الجداول

### 3.2 المجلدات الرئيسية
```
src/
├── app/
│   ├── api/           ← 205 route.ts (REST endpoints)
│   ├── auth/          ← login / register
│   └── dashboard/     ← 50 صفحة dashboard
│       ├── operations-room/   ← غرفة العمليات (ADMIN)
│       ├── executor-city/     ← مدينتي (EXECUTOR) — canvas city
│       ├── approvals/         ← الموافقات (4 tabs)
│       ├── branch/            ← فريقي (BRANCH_MANAGER)
│       ├── projects/          ← المشاريع + wizard الإنشاء
│       ├── service-catalog/   ← كتالوج الخدمات
│       └── ...
├── components/        ← 30+ مكون مشترك
├── lib/               ← helpers مشتركة
│   ├── auth.ts            ← NextAuth config
│   ├── prisma.ts          ← Prisma singleton
│   ├── working-days.ts    ← حساب أيام العمل (السبت إجازة)
│   ├── service-duration.ts← حساب مدة الخدمة
│   ├── project-code.ts    ← توليد رمز المشروع
│   ├── notifications.ts   ← Pusher notifications
│   ├── permissions.ts     ← can() + getUserPermissions()
│   ├── validations.ts     ← normalizePhone (E.164)
│   ├── delay-report-pdf.ts← تقرير التأخير PDF
│   ├── duration-report-pdf.ts ← تقرير المدة PDF
│   └── export-utils.ts    ← Excel/PDF export
├── i18n/              ← ar.ts + en.ts (Arabic default)
└── generated/prisma/  ← Prisma client output
```

---

## 4. الوظائف الرئيسية

### 4.1 إدارة المشاريع
- **إنشاء مشروع:** wizard من 5 خطوات (بيانات → عقد → خدمات → مدير → مراجعة)
- **قوالب المشاريع:** حفظ/تحميل + modal "لماذا X يوم؟" مع تصدير PDF
- **الشركاء:** عدد شركاء 1-10 مع أسماء + مستندات لكل شريك
- **رمز المشروع:** YY + clientNo + deptNo + contractNo + seq (بدون padding)
- **إيقاف/استئناف:** ProjectPause مع إشعارات + تقرير التأخير + PDF
- **نظام canStart:** SEQUENTIAL / PARALLEL / INDEPENDENT / isBackground

### 4.2 إدارة المهام
- **متطلبات الإكمال:** TaskRequirement (TEXT/FILE/URL/SELECT) مع modal تسلسلي
- **الدفعات:** ContractPaymentInstallment يقفل المهام (isLocked + linkedTaskId)
- **طلب إمهال:** task grace + installment grace مع موافقة إدارية
- **التراجع عن الإكمال:** DONE → IN_PROGRESS مع audit trail
- **التحويل:** TaskTransferRequest مع سلسلة موافقة
- **مدينتي (Canvas):** مباني تمثل المشاريع — متهدمة للمتأخر، ملونة للمكتمل

### 4.3 التوزيع التلقائي
- **DepartmentAssignmentPool:** ROUND_ROBIN أو ALL
- **executorId override:** اختيار يدوي من wizard
- **Investment department:** pickInvestmentAssignee (date-priority + load balancing)
- **qualifiedEmployees:** fallback round-robin

### 4.4 إدارة العمليات (Operations Room)
- شجرة هرمية: قسم → مشروع → خدمة → مهمة
- المؤهلون + موظفو الطوارئ per service
- إيقاف/استئناف + تقرير التأخير PDF
- تواريخ مزدوجة: عقد + تنفيذ + مؤشرات تأخير
- فريق المشاريع الافتراضي (DepartmentPoolManager)

### 4.5 صفحة الموافقات (/dashboard/approvals)
4 tabs:
1. تحويلات المهام (PENDING_ADMIN)
2. طلبات الدفع (جزئي/كامل)
3. إمهال الدفعات (grace)
4. إمهال المهام (task grace)

### 4.6 المالية
- ContractPaymentInstallment + partial payment + grace period
- PaymentRequest (سلسلة: PENDING_SUPERVISOR → FINANCE → TREASURY → PAID)
- DepartmentPayment + installments
- Cashier module
- Invoices + tax calculation (15% VAT)

### 4.7 المستندات
- DocType + DocumentGroup + ProjectDocument (per department)
- TaskRequirement FILE uploads (via UploadThing taskRequirementFile endpoint)
- صفحة متطلبات المشروع: تعرض المكتملة + الغير مكتملة

---

## 5. الـ API Endpoints الأساسية (205 route)

| المجموعة | الأهم |
|---|---|
| `/api/projects` | GET (list), POST (create), `[id]` GET/PATCH, `/generate`, `/[id]/pause`, `/[id]/resume`, `/[id]/pause-report`, `/[id]/task-requirements`, `/[id]/partners` |
| `/api/tasks` | `[id]` PATCH, `/[id]/requirements/complete`, `/[id]/grace-request/approve/reject`, `/[id]/revert`, `/pending-grace-requests` |
| `/api/my-tasks` | `/all` (paginated + computeCanStart), `/[id]/status`, `/[id]/complete`, `/bulk-update` |
| `/api/installments` | `/[id]/pay`, `/[id]/partial-request/approve/reject`, `/[id]/grace-request/approve/reject`, `/pending-approvals` |
| `/api/operations` | `/overview` (projects + executors + stats) |
| `/api/service-catalog` | `/templates` GET/POST, `/categories`, `/templates/[id]/tasks`, `/templates/[id]/escalation` |
| `/api/project-templates` | GET/POST, `[id]` GET/PATCH/DELETE, `[id]/clone` |
| `/api/departments` | `[id]/assignment-pool` GET/POST, `[id]/assignment-pool/[userId]` DELETE, `[id]/health` |
| `/api/branch` | `/overview` (subordinates stats) |
| `/api/contracts` | GET/POST, `/standalone`, `/check-expiry`, `/expiring`, `[id]` |
| `/api/users` | GET/POST, `[id]` GET/PATCH/DELETE, `/search`, `[id]/services` |
| `/api/auth` | `/register` POST, NextAuth credentials |

---

## 6. الملفات الكبيرة / المعقدة

| الملف | الأسطر | الوصف |
|---|---|---|
| `projects/new/page.tsx` | 2,643 | wizard إنشاء المشروع (5 خطوات + services catalog + milestones) |
| `MyTasksView.tsx` | 2,408 | عرض المهام (mobile cards + desktop table + 5 modals) |
| `OperationsRoomClient.tsx` | 1,732 | غرفة العمليات (شجرة + modals + pool manager) |
| `executor-city/page.tsx` | ~1,200 | Canvas city مع مباني + حيوانات + رافعات |
| `api/projects/route.ts` | ~800 | POST handler مع pool + milestones + partners |

---

## 7. التكاملات الخارجية

| الخدمة | الحالة | الملفات |
|---|---|---|
| **Supabase PostgreSQL** | ✅ مكتمل | `src/lib/prisma.ts`, `scripts/db.ts` |
| **Pusher** (real-time) | ✅ مكتمل | `src/lib/pusher.ts`, `src/lib/pusher-client.ts`, `src/lib/notifications.ts` |
| **UploadThing** (file upload) | ✅ مكتمل | `src/lib/uploadthing.ts`, `src/app/api/uploadthing/core.ts` (4 endpoints: chatImage, documentUploader, taskRequirementFile, avatarUploader) |
| **NextAuth** (phone auth) | ✅ مكتمل | `src/lib/auth.ts` |
| **Vercel** (deploy) | ✅ مكتمل | auto-deploy on push to main |
| **Google Drive** | ❌ غير موجود | — |
| **Payment Gateway** | ❌ غير موجود | المدفوعات تُسجّل يدوياً |
| **Email/SMS** | ❌ غير موجود | Pusher فقط للإشعارات |

---

## 8. الحالة الحالية

**آخر commit:**
```
8e41d40 fix(task-requirements): return all template requirements, not just filled
```

**Git status:** نظيف (لا ملفات معدّلة)

**الـ branches:** `main` فقط (single-branch workflow)

**TODOs/FIXMEs:** 66 موضع في الكود (معظمها comments تحذيرية، ليست bugs حرجة)

**Lint:** 143 warning + 82 error (معظمها `@typescript-eslint/no-explicit-any` و `no-unused-vars` في ملفات قديمة — لا تمنع البناء)

**tsc --noEmit:** ✅ نظيف (0 errors)

---

## 9. مشاكل معروفة / نقاط تحتاج اهتمام

### 9.1 معمارية
- **لا يوجد test runner** — لا unit tests ولا integration tests
- **لا يوجد `prisma.$transaction`** — pgbouncer transaction mode لا يدعمه. كل العمليات المركبة (إنشاء مشروع + خدمات + مهام) تُنفَّذ كاستعلامات متتابعة بلا atomicity
- **Prisma client lazy singleton** عبر Proxy — يتجنب الاتصال المبكر لكنه يجعل debugging أصعب

### 9.2 أداء
- `OperationsRoomClient.tsx` (1,732 سطر) و `MyTasksView.tsx` (2,408 سطر) كبيرة جداً — يمكن تقسيمها لمكونات أصغر
- `computeCanStart` يُشغّل لكل مهمة في كل fetch — O(n²) على المهام × الخدمات
- Canvas city يُعاد رسمه كل frame — لا memoization للمباني الثابتة

### 9.3 بيانات
- بعض المشاريع القديمة لها `serviceOrder=0` لكل الخدمات (before fix)
- بعض الخدمات القديمة لا تحمل `isBackground` أو `executionMode` صحيح (before backfill)
- `User.email` nullable — لا يمكن استخدام `findUnique({ where: { email } })` مباشرة

### 9.4 أمان
- Password hashing: bcryptjs (12 rounds) ✅
- Phone normalization: E.164 canonical ✅
- `can()` bypasses for ADMIN/MANAGER without permission check ✅ (intentional)
- No CSRF protection (Next.js App Router handles via same-origin) ✅
- No rate limiting on auth endpoints ⚠️

---

## 10. كيف يتم تشغيل المشروع محلياً

### 10.1 الأوامر
```bash
npm install          # تثبيت التبعيات
npm run dev          # Next.js dev server (http://localhost:3000)
npm run build        # prisma generate && next build
npm run lint         # ESLint
npx prisma generate  # توليد Prisma client
npx prisma db push --url 'postgresql://...:5432/...'  # DDL (direct connection)
npx tsx scripts/<file>.ts  # تشغيل أي script
```

### 10.2 متغيرات البيئة (.env)
```env
DATABASE_URL=           # Supabase pooler (port 6543, ?pgbouncer=true)
NEXTAUTH_SECRET=        # JWT secret
NEXTAUTH_URL=           # http://localhost:3000

PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=

UPLOADTHING_TOKEN=

# .env.production uses the Supabase pooler URL
# For db push: use direct connection on port 5432
```

### 10.3 ملاحظات
- الخط: **Tajawal** (Google Fonts) — يُحمّل عبر `next/font`
- الاتجاه: **RTL** — `<html lang="ar" dir="rtl">`
- أسبوع العمل السعودي: 6 أيام (السبت إجازة) — `src/lib/working-days.ts`
- PWA: `public/sw.js` + `manifest.json`
- الـ seed: `npx tsx prisma/seed.ts` (entry point في `package.json`)

---

## نظام الدفعات (Payments)

### Workflow استلام الدفعات (2026-04-25)

**التسجيل (EXECUTOR):**
- API: POST /api/installments/[id]/record-payment
- صلاحية: EXECUTOR (مرتبط بمهمة القسط) أو ADMIN/MANAGER
- يحدّث: paymentStatus=PAID, isLocked=false, confirmationStatus=PENDING_CONFIRMATION
- يفتح المهمة المرتبطة + القسط التالي تلقائياً
- إشعارات لـ ADMIN/MANAGER/FINANCE_MANAGER
- AuditLog: INSTALLMENT_RECORDED (severity=WARN)

**التأكيد (ADMIN/MANAGER/FINANCE_MANAGER):**
- API: POST /api/installments/[id]/confirm-payment
- action: CONFIRM | REJECT
- REJECT يتطلب rejectionReason
- REJECT يعكس كل شي: paymentStatus=UNPAID, isLocked=true
- AuditLog: INSTALLMENT_CONFIRMED (WARN) أو INSTALLMENT_REJECTED (CRITICAL)

**الواجهات:**
- المنفذ: زر "تأكيد استلام الدفعة" في MyTasksView (يستدعي record-payment)
- الأدمن: tab "تأكيد الدفعات" في /dashboard/approvals (5th tab)

**الأقساط القديمة:**
- pay, mark_paid, partial-*, grace-* لا تزال تعمل
- workflow الجديد إضافي بجوارها

### قواعد إنشاء العقد (مهم!)

عند POST /api/contracts:
- isLocked = idx > 0 (الأول مفتوح، الباقي مقفل)
- linkedTaskId يُقبل في payload

**سبب القاعدة:** قبل 2026-04-25 كانت كل الأقساط isLocked=false (ثغرة).
