import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const dbUrl = new URL(process.env.DATABASE_URL!.replace("mysql://", "http://"));
const adapter = new PrismaMariaDb({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port || "4000"),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.slice(1),
  ssl: true,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("جارٍ إضافة بيانات الموارد البشرية...");

  // جلب أو إنشاء شركة
  const admin = await prisma.user.findUnique({ where: { email: "admin@marsa.sa" } });
  if (!admin) { console.error("يجب تشغيل seed-projects.ts أولاً"); process.exit(1); }

  let company = await prisma.company.findFirst({ where: { ownerId: admin.id } });
  if (!company) {
    company = await prisma.company.create({
      data: { name: "شركة الابتكار للتقنية", ownerId: admin.id, sector: "تقنية", commercialRegister: "1234567890" },
    });
  }

  const employees = [
    {
      name: "أحمد بن سعد الغامدي",
      nationality: "سعودي",
      nationalId: "1098765432",
      dateOfBirth: new Date("1990-03-15"),
      jobTitle: "مدير تقنية المعلومات",
      department: "التقنية",
      hireDate: new Date("2023-01-15"),
      baseSalary: 18000,
      housingAllowance: 4500,
      transportAllowance: 1500,
      phone: "0501112233",
      email: "ahmed@innovation.sa",
      passportNumber: "A12345678",
      residencyExpiry: null,
      insuranceExpiry: new Date("2027-01-15"),
    },
    {
      name: "نورة بنت عبدالرحمن العمري",
      nationality: "سعودية",
      nationalId: "1087654321",
      dateOfBirth: new Date("1992-07-20"),
      jobTitle: "محاسبة أولى",
      department: "المالية",
      hireDate: new Date("2023-06-01"),
      baseSalary: 14000,
      housingAllowance: 3500,
      transportAllowance: 1200,
      phone: "0554443322",
      email: "noura@innovation.sa",
      passportNumber: "A87654321",
      residencyExpiry: null,
      insuranceExpiry: new Date("2027-06-01"),
    },
    {
      name: "خالد محمد الحربي",
      nationality: "سعودي",
      nationalId: "1076543210",
      dateOfBirth: new Date("1988-11-08"),
      jobTitle: "مدير المشاريع",
      department: "العمليات",
      hireDate: new Date("2022-09-10"),
      baseSalary: 20000,
      housingAllowance: 5000,
      transportAllowance: 2000,
      phone: "0567778899",
      email: "khaled@innovation.sa",
      passportNumber: "A11223344",
      residencyExpiry: null,
      insuranceExpiry: new Date("2026-09-10"),
    },
    {
      name: "راجيش كومار",
      nationality: "هندي",
      nationalId: "2345678901",
      dateOfBirth: new Date("1985-05-25"),
      jobTitle: "مطور برمجيات أول",
      department: "التقنية",
      hireDate: new Date("2024-02-01"),
      baseSalary: 12000,
      housingAllowance: 3000,
      transportAllowance: 1000,
      phone: "0589990011",
      email: "rajesh@innovation.sa",
      passportNumber: "P98765432",
      residencyExpiry: new Date("2026-08-01"),
      insuranceExpiry: new Date("2026-08-01"),
      status: "ON_LEAVE" as const,
    },
    {
      name: "فاطمة بنت حسين الزهراني",
      nationality: "سعودية",
      nationalId: "1065432109",
      dateOfBirth: new Date("1995-01-12"),
      jobTitle: "أخصائية موارد بشرية",
      department: "الموارد البشرية",
      hireDate: new Date("2024-04-15"),
      baseSalary: 11000,
      housingAllowance: 2750,
      transportAllowance: 1000,
      phone: "0512223344",
      email: "fatima@innovation.sa",
      passportNumber: "A99887766",
      residencyExpiry: null,
      insuranceExpiry: new Date("2027-04-15"),
    },
  ];

  const createdEmps: string[] = [];
  for (const emp of employees) {
    const created = await prisma.employee.create({
      data: { ...emp, companyId: company.id },
    });
    createdEmps.push(created.id);
  }
  console.log(`تم إنشاء ${employees.length} موظفين`);

  // إجازات تجريبية
  const leaves = [
    { employeeId: createdEmps[3], type: "ANNUAL" as const, startDate: new Date("2026-03-01"), endDate: new Date("2026-03-15"), status: "APPROVED" as const, reason: "إجازة سنوية للسفر" },
    { employeeId: createdEmps[0], type: "SICK" as const, startDate: new Date("2026-03-10"), endDate: new Date("2026-03-12"), status: "PENDING" as const, reason: "مراجعة طبية" },
    { employeeId: createdEmps[4], type: "EMERGENCY" as const, startDate: new Date("2026-03-08"), endDate: new Date("2026-03-09"), status: "PENDING" as const, reason: "ظرف عائلي" },
  ];
  for (const l of leaves) { await prisma.leaveRequest.create({ data: l }); }
  console.log(`تم إنشاء ${leaves.length} طلبات إجازة`);

  // حضور تجريبي لليوم
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const attendances = [
    { employeeId: createdEmps[0], date: today, checkIn: new Date(today.getTime() + 8 * 3600000), checkOut: new Date(today.getTime() + 17 * 3600000), status: "PRESENT" as const },
    { employeeId: createdEmps[1], date: today, checkIn: new Date(today.getTime() + 7.5 * 3600000), checkOut: new Date(today.getTime() + 16.5 * 3600000), status: "PRESENT" as const },
    { employeeId: createdEmps[2], date: today, checkIn: new Date(today.getTime() + 9.5 * 3600000), checkOut: null, status: "LATE" as const },
    { employeeId: createdEmps[3], date: today, checkIn: null, checkOut: null, status: "EXCUSED" as const },
    { employeeId: createdEmps[4], date: today, checkIn: new Date(today.getTime() + 8.25 * 3600000), checkOut: new Date(today.getTime() + 16 * 3600000), status: "PRESENT" as const },
  ];
  for (const a of attendances) { await prisma.attendance.create({ data: a }); }
  console.log(`تم إنشاء ${attendances.length} سجلات حضور`);

  console.log("\nتم إضافة بيانات الموارد البشرية بنجاح!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
