"use client";

import Link from "next/link";
import MarsaLogo from "@/components/MarsaLogo";
import {
  Building2,
  TrendingUp,
  Home,
  Wrench,
  Shield,
  Users,
  FileText,
  BarChart3,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import { useState } from "react";

const departments = [
  {
    icon: TrendingUp,
    name: "قسم الاستثمار",
    nameEn: "Investment",
    desc: "تأسيس الشركات، الرخص التجارية، التراخيص الاستثمارية",
    color: "#5E5495",
  },
  {
    icon: Shield,
    name: "قسم الإقامة المميزة",
    nameEn: "Premium Residency",
    desc: "إصدار وتجديد الإقامات المميزة والتأشيرات",
    color: "#C9A84C",
  },
  {
    icon: Home,
    name: "قسم العقار",
    nameEn: "Real Estate",
    desc: "التملك العقاري، إدارة الأملاك، التثمين",
    color: "#059669",
  },
  {
    icon: Wrench,
    name: "قسم الخدمات",
    nameEn: "Services",
    desc: "الخدمات الحكومية، التعقيب، الترجمة المعتمدة",
    color: "#EA580C",
  },
];

const features = [
  {
    icon: Building2,
    title: "إدارة مشاريع متكاملة",
    desc: "تتبع المشاريع من البداية للنهاية مع تقارير فورية",
  },
  {
    icon: FileText,
    title: "عقود إلكترونية",
    desc: "إنشاء وتوقيع العقود إلكترونيًا مع قوالب جاهزة",
  },
  {
    icon: Users,
    title: "بوابة العملاء",
    desc: "بوابة خاصة لكل عميل لمتابعة مشاريعه وخدماته",
  },
  {
    icon: BarChart3,
    title: "تقارير وتحليلات",
    desc: "تقارير مالية وإدارية شاملة لاتخاذ قرارات أفضل",
  },
];

export default function LandingPage() {
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div className="min-h-screen" dir="rtl" style={{ backgroundColor: "#FAFAFA" }}>
      {/* ═══ Navigation ═══ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md"
        style={{ backgroundColor: "rgba(28,27,46,0.95)", borderBottom: "1px solid rgba(201,168,76,0.15)" }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MarsaLogo size={36} variant="light" />
            <div>
              <span className="text-lg font-bold" style={{ color: "#C9A84C" }}>مرسى</span>
              <span className="text-[10px] block" style={{ color: "rgba(255,255,255,0.4)" }}>خدمات رجال الأعمال</span>
            </div>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#departments" className="text-sm font-medium transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.7)" }}>
              أقسامنا
            </a>
            <a href="#features" className="text-sm font-medium transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.7)" }}>
              المميزات
            </a>
            <a href="#contact" className="text-sm font-medium transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.7)" }}>
              تواصل معنا
            </a>
            <MarsaButton href="/auth/login" variant="gold" size="sm">
              تسجيل الدخول
            </MarsaButton>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenu(!mobileMenu)}
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            <ChevronDown size={20} className={`transition-transform ${mobileMenu ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileMenu && (
          <div className="md:hidden px-6 pb-4 space-y-3">
            <a href="#departments" onClick={() => setMobileMenu(false)} className="block text-sm py-2" style={{ color: "rgba(255,255,255,0.7)" }}>أقسامنا</a>
            <a href="#features" onClick={() => setMobileMenu(false)} className="block text-sm py-2" style={{ color: "rgba(255,255,255,0.7)" }}>المميزات</a>
            <a href="#contact" onClick={() => setMobileMenu(false)} className="block text-sm py-2" style={{ color: "rgba(255,255,255,0.7)" }}>تواصل معنا</a>
            <MarsaButton href="/auth/login" variant="gold" size="sm" className="w-full">تسجيل الدخول</MarsaButton>
          </div>
        )}
      </nav>

      {/* ═══ Hero Section ═══ */}
      <section
        className="relative pt-32 pb-20 px-6 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #2A2542 0%, #1C1B2E 60%, #15132A 100%)" }}
      >
        {/* Decorative circles */}
        <div className="absolute top-20 left-10 w-72 h-72 rounded-full opacity-5" style={{ backgroundColor: "#C9A84C" }} />
        <div className="absolute bottom-10 right-20 w-96 h-96 rounded-full opacity-5" style={{ backgroundColor: "#5E5495" }} />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8" style={{ backgroundColor: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)" }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#C9A84C" }} />
            <span className="text-xs font-medium" style={{ color: "#C9A84C" }}>منصة متكاملة لخدمات الأعمال</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6" style={{ color: "#FFFFFF" }}>
            شريكك في{" "}
            <span style={{ color: "#C9A84C" }}>نجاح أعمالك</span>
            <br />
            في المملكة العربية السعودية
          </h1>

          <p className="text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            نقدم حلولاً متكاملة للاستثمار والإقامة والعقار والخدمات الحكومية
            بأعلى معايير الجودة والاحترافية
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <MarsaButton href="/auth/login" variant="gold" size="lg" icon={<ArrowLeft size={18} />}>
              ابدأ الآن
            </MarsaButton>
            <MarsaButton href="#departments" variant="outline" size="lg" style={{ borderColor: "rgba(255,255,255,0.2)", color: "#FFFFFF" }}>
              تعرف على خدماتنا
            </MarsaButton>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-3xl mx-auto">
            {[
              { value: "4", label: "أقسام متخصصة" },
              { value: "+50", label: "خدمة متنوعة" },
              { value: "24/7", label: "دعم فني" },
              { value: "+100", label: "عميل راضٍ" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold" style={{ color: "#C9A84C" }}>{stat.value}</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Departments Section ═══ */}
      <section id="departments" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold mb-2" style={{ color: "#C9A84C" }}>أقسامنا</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: "#1C1B2E" }}>
              أربعة أقسام متخصصة لخدمتك
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {departments.map((dept) => {
              const Icon = dept.icon;
              return (
                <div
                  key={dept.name}
                  className="bg-white rounded-2xl p-6 transition-all hover:shadow-xl hover:-translate-y-1 group"
                  style={{ border: "1px solid #E2E0D8" }}
                >
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-colors"
                    style={{ backgroundColor: `${dept.color}12` }}
                  >
                    <Icon size={28} style={{ color: dept.color }} />
                  </div>
                  <h3 className="text-lg font-bold mb-1" style={{ color: "#1C1B2E" }}>{dept.name}</h3>
                  <p className="text-xs mb-3" style={{ color: "#9CA3AF" }}>{dept.nameEn}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>{dept.desc}</p>
                  <div className="w-full h-1 rounded-full mt-5 transition-all opacity-50 group-hover:opacity-100" style={{ backgroundColor: dept.color }} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ Features Section ═══ */}
      <section id="features" className="py-20 px-6" style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold mb-2" style={{ color: "#5E5495" }}>لماذا مرسى؟</p>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: "#1C1B2E" }}>
              منصة ذكية لإدارة أعمالك
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="flex gap-5 p-6 rounded-2xl transition-all hover:shadow-md"
                  style={{ backgroundColor: "#FAFAFE", border: "1px solid #F0EDE6" }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "rgba(94,84,149,0.08)" }}
                  >
                    <Icon size={24} style={{ color: "#5E5495" }} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold mb-1" style={{ color: "#1C1B2E" }}>{feat.title}</h3>
                    <p className="text-sm" style={{ color: "#6B7280" }}>{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ CTA Section ═══ */}
      <section className="py-16 px-6" style={{ background: "linear-gradient(135deg, #2A2542, #1C1B2E)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: "#FFFFFF" }}>
            جاهز لتطوير أعمالك؟
          </h2>
          <p className="text-base mb-8" style={{ color: "rgba(255,255,255,0.6)" }}>
            سجّل الآن واحصل على إدارة متكاملة لمشاريعك وخدماتك
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <MarsaButton href="/auth/register" variant="gold" size="lg">
              إنشاء حساب مجاني
            </MarsaButton>
            <MarsaButton href="/auth/login" variant="secondary" size="lg" style={{ borderColor: "rgba(255,255,255,0.2)", color: "#FFFFFF" }}>
              تسجيل الدخول
            </MarsaButton>
          </div>
        </div>
      </section>

      {/* ═══ Contact Section ═══ */}
      <section id="contact" className="py-20 px-6" style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold mb-2" style={{ color: "#C9A84C" }}>تواصل معنا</p>
            <h2 className="text-3xl font-bold" style={{ color: "#1C1B2E" }}>نسعد بخدمتك</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 rounded-2xl" style={{ backgroundColor: "#FAFAFE", border: "1px solid #F0EDE6" }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(201,168,76,0.1)" }}>
                <Phone size={20} style={{ color: "#C9A84C" }} />
              </div>
              <p className="text-sm font-bold mb-1" style={{ color: "#1C1B2E" }}>اتصل بنا</p>
              <p className="text-sm" dir="ltr" style={{ color: "#6B7280" }}>+966 XX XXX XXXX</p>
            </div>
            <div className="text-center p-6 rounded-2xl" style={{ backgroundColor: "#FAFAFE", border: "1px solid #F0EDE6" }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(94,84,149,0.1)" }}>
                <Mail size={20} style={{ color: "#5E5495" }} />
              </div>
              <p className="text-sm font-bold mb-1" style={{ color: "#1C1B2E" }}>البريد الإلكتروني</p>
              <p className="text-sm" dir="ltr" style={{ color: "#6B7280" }}>info@bmarsa.com</p>
            </div>
            <div className="text-center p-6 rounded-2xl" style={{ backgroundColor: "#FAFAFE", border: "1px solid #F0EDE6" }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(5,150,105,0.1)" }}>
                <MapPin size={20} style={{ color: "#059669" }} />
              </div>
              <p className="text-sm font-bold mb-1" style={{ color: "#1C1B2E" }}>الموقع</p>
              <p className="text-sm" style={{ color: "#6B7280" }}>المملكة العربية السعودية</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer style={{ backgroundColor: "#1C1B2E", borderTop: "1px solid rgba(201,168,76,0.1)" }}>
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MarsaLogo size={28} variant="light" />
              <span className="text-sm font-bold" style={{ color: "#C9A84C" }}>مرسى</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>— خدمات رجال الأعمال</span>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              © {new Date().getFullYear()} مرسى. جميع الحقوق محفوظة.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
