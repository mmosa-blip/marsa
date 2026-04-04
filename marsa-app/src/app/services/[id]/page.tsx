"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock,
  DollarSign,
  Tag,
  CheckCircle2,
  Send,
  Shield,
  Star,
  Headphones,
  Scale,
  FileCheck,
  Users,
  Calculator,
  Megaphone,
  Building2,
  Briefcase,
} from "lucide-react";
import MarsaLogo from "@/components/MarsaLogo";
import SarSymbol from "@/components/SarSymbol";

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
  duration: number | null;
  isActive: boolean;
  createdAt: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  "خدمات قانونية": <Scale size={32} />,
  "خدمات حكومية": <FileCheck size={32} />,
  "موارد بشرية": <Users size={32} />,
  "خدمات مالية": <Calculator size={32} />,
  "تسويق": <Megaphone size={32} />,
};

function getCategoryIcon(category: string | null) {
  if (!category) return <Briefcase size={32} />;
  return categoryIcons[category] || <Building2 size={32} />;
}

const features = [
  {
    icon: <Shield size={20} />,
    title: "ضمان الجودة",
    desc: "نلتزم بأعلى معايير الجودة في تقديم خدماتنا",
  },
  {
    icon: <Star size={20} />,
    title: "فريق متخصص",
    desc: "خبراء ومتخصصون في مجالاتهم",
  },
  {
    icon: <Headphones size={20} />,
    title: "دعم مستمر",
    desc: "متابعة ودعم فني طوال فترة تنفيذ الخدمة",
  },
];

export default function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/services/${id}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          setLoading(false);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setService(data);
          setLoading(false);
        }
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#F8F9FA" }}
      >
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="#1C1B2E"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="#1C1B2E"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p style={{ color: "#2D3748", opacity: 0.6 }}>جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  if (notFound || !service) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#F8F9FA" }}
      >
        <div className="text-center">
          <Briefcase
            size={64}
            className="mx-auto mb-4"
            style={{ color: "#C9A84C", opacity: 0.4 }}
          />
          <h2 className="text-2xl font-bold mb-2" style={{ color: "#1C1B2E" }}>
            الخدمة غير موجودة
          </h2>
          <p className="mb-6" style={{ color: "#2D3748", opacity: 0.6 }}>
            لم نتمكن من العثور على الخدمة المطلوبة
          </p>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium"
            style={{ backgroundColor: "#5E5495" }}
          >
            <ArrowRight size={16} />
            العودة للخدمات
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F8F9FA" }}>
      {/* الهيدر */}
      <header
        className="relative overflow-hidden"
        style={{ backgroundColor: "#5E5495" }}
      >
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute -top-20 -right-20 w-96 h-96 rounded-full"
            style={{ border: "2px solid #C9A84C" }}
          />
          <div
            className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full"
            style={{ border: "2px solid #C9A84C" }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <nav className="flex items-center justify-between mb-10">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm"
            >
              <ArrowRight size={16} />
              رجوع
            </button>
            <Link href="/" className="flex items-center gap-2">
              <MarsaLogo size={26} variant="light" />
              <span
                className="text-xl font-bold"
                style={{ color: "#C9A84C" }}
              >
                مرسى
              </span>
            </Link>
          </nav>

          <div className="flex items-center gap-6 pb-8" dir="rtl">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: "rgba(201, 168, 76, 0.15)",
                border: "2px solid rgba(201, 168, 76, 0.3)",
                color: "#C9A84C",
              }}
            >
              {getCategoryIcon(service.category)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {service.name}
              </h1>
              {service.category && (
                <span className="inline-flex items-center gap-1.5 text-sm text-white/50">
                  <Tag size={14} />
                  {service.category}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* المحتوى */}
      <main className="max-w-7xl mx-auto px-6 -mt-4" dir="rtl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* العمود الرئيسي */}
          <div className="lg:col-span-2 space-y-6">
            {/* وصف الخدمة */}
            <div
              className="bg-white rounded-2xl p-8"
              style={{ border: "1px solid #E2E0D8" }}
            >
              <h2
                className="text-xl font-bold mb-4"
                style={{ color: "#1C1B2E" }}
              >
                عن الخدمة
              </h2>
              <p
                className="leading-relaxed text-base"
                style={{ color: "#2D3748", opacity: 0.8 }}
              >
                {service.description}
              </p>
            </div>

            {/* ما تشمله الخدمة */}
            <div
              className="bg-white rounded-2xl p-8"
              style={{ border: "1px solid #E2E0D8" }}
            >
              <h2
                className="text-xl font-bold mb-6"
                style={{ color: "#1C1B2E" }}
              >
                ما تشمله الخدمة
              </h2>
              <div className="space-y-4">
                {[
                  "دراسة وتحليل متطلباتك",
                  "تنفيذ احترافي بأعلى المعايير",
                  "متابعة مستمرة حتى الإنجاز",
                  "تقرير تفصيلي عند الانتهاء",
                  "دعم فني بعد التسليم",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2
                      size={20}
                      style={{ color: "#C9A84C" }}
                      className="flex-shrink-0"
                    />
                    <span style={{ color: "#2D3748" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* المميزات */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {features.map((feature, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-6 text-center"
                  style={{ border: "1px solid #E2E0D8" }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                    style={{
                      backgroundColor: "rgba(201, 168, 76, 0.1)",
                      color: "#C9A84C",
                    }}
                  >
                    {feature.icon}
                  </div>
                  <h3
                    className="font-bold text-sm mb-1"
                    style={{ color: "#1C1B2E" }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="text-xs"
                    style={{ color: "#2D3748", opacity: 0.6 }}
                  >
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* العمود الجانبي */}
          <div className="space-y-6">
            {/* بطاقة الطلب */}
            <div
              className="bg-white rounded-2xl p-6 sticky top-6"
              style={{
                border: "1px solid #E2E0D8",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              }}
            >
              <h3
                className="text-lg font-bold mb-6"
                style={{ color: "#1C1B2E" }}
              >
                ملخص الخدمة
              </h3>

              <div className="space-y-4 mb-6">
                {service.price && (
                  <div
                    className="flex items-center justify-between p-4 rounded-xl"
                    style={{ backgroundColor: "rgba(27, 42, 74, 0.03)" }}
                  >
                    <span
                      className="flex items-center gap-2 text-sm"
                      style={{ color: "#2D3748", opacity: 0.7 }}
                    >
                      <DollarSign size={16} style={{ color: "#C9A84C" }} />
                      السعر
                    </span>
                    <div className="text-left">
                      <span
                        className="text-2xl font-bold"
                        style={{ color: "#1C1B2E" }}
                      >
                        {service.price.toLocaleString("en-US")}
                      </span>
                      <SarSymbol size={14} />
                    </div>
                  </div>
                )}

                {service.duration && (
                  <div
                    className="flex items-center justify-between p-4 rounded-xl"
                    style={{ backgroundColor: "rgba(27, 42, 74, 0.03)" }}
                  >
                    <span
                      className="flex items-center gap-2 text-sm"
                      style={{ color: "#2D3748", opacity: 0.7 }}
                    >
                      <Clock size={16} style={{ color: "#C9A84C" }} />
                      مدة التنفيذ
                    </span>
                    <span
                      className="font-bold"
                      style={{ color: "#1C1B2E" }}
                    >
                      {service.duration} يوم
                    </span>
                  </div>
                )}

                {service.category && (
                  <div
                    className="flex items-center justify-between p-4 rounded-xl"
                    style={{ backgroundColor: "rgba(27, 42, 74, 0.03)" }}
                  >
                    <span
                      className="flex items-center gap-2 text-sm"
                      style={{ color: "#2D3748", opacity: 0.7 }}
                    >
                      <Tag size={16} style={{ color: "#C9A84C" }} />
                      التصنيف
                    </span>
                    <span
                      className="font-bold text-sm"
                      style={{ color: "#1C1B2E" }}
                    >
                      {service.category}
                    </span>
                  </div>
                )}
              </div>

              <button
                className="w-full py-4 rounded-xl text-white font-semibold transition-all duration-200 flex items-center justify-center gap-2 hover:shadow-lg"
                style={{
                  backgroundColor: "#5E5495",
                  boxShadow: "0 4px 15px rgba(27, 42, 74, 0.3)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#243557";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#1C1B2E";
                }}
              >
                <Send size={18} />
                اطلب الخدمة الآن
              </button>

              <p
                className="text-center text-xs mt-4"
                style={{ color: "#2D3748", opacity: 0.5 }}
              >
                سيتم التواصل معك خلال 24 ساعة
              </p>
            </div>

            {/* بطاقة التواصل */}
            <div
              className="rounded-2xl p-6"
              style={{
                backgroundColor: "rgba(27, 42, 74, 0.04)",
                border: "1px solid #E2E0D8",
              }}
            >
              <h4
                className="font-bold text-sm mb-2"
                style={{ color: "#1C1B2E" }}
              >
                تحتاج استشارة؟
              </h4>
              <p
                className="text-xs mb-4"
                style={{ color: "#2D3748", opacity: 0.6 }}
              >
                تواصل مع فريقنا للحصول على استشارة مجانية حول هذه الخدمة
              </p>
              <button
                className="w-full py-3 rounded-xl text-sm font-medium transition-all duration-200"
                style={{
                  border: "1.5px solid #C9A84C",
                  color: "#C9A84C",
                  backgroundColor: "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#C9A84C";
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#C9A84C";
                }}
              >
                تواصل معنا
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* الفوتر */}
      <footer
        className="mt-16 py-8"
        style={{ borderTop: "1px solid #E2E0D8" }}
      >
        <div className="text-center">
          <p className="text-xs" style={{ color: "#2D3748", opacity: 0.4 }}>
            &copy; 2024 مرسى. جميع الحقوق محفوظة
          </p>
        </div>
      </footer>
    </div>
  );
}
