"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Clock,
  DollarSign,
  Tag,
  ArrowLeft,
  Building2,
  FileCheck,
  Scale,
  Users,
  Calculator,
  Megaphone,
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
}

const categoryIcons: Record<string, React.ReactNode> = {
  "خدمات قانونية": <Scale size={24} />,
  "خدمات حكومية": <FileCheck size={24} />,
  "موارد بشرية": <Users size={24} />,
  "خدمات مالية": <Calculator size={24} />,
  "تسويق": <Megaphone size={24} />,
};

function getCategoryIcon(category: string | null) {
  if (!category) return <Briefcase size={24} />;
  return categoryIcons[category] || <Building2 size={24} />;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("الكل");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/services")
      .then((res) => res.json())
      .then((data: Service[]) => {
        setServices(data);
        setFilteredServices(data);
        const cats = [
          ...new Set(data.map((s) => s.category).filter(Boolean)),
        ] as string[];
        setCategories(cats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = services;

    if (activeCategory !== "الكل") {
      result = result.filter((s) => s.category === activeCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q)
      );
    }

    setFilteredServices(result);
  }, [activeCategory, searchQuery, services]);

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
            className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full"
            style={{ border: "2px solid #C9A84C" }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-8">
          {/* شريط التنقل */}
          <nav className="flex items-center justify-between mb-12">
            <Link
              href="/"
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft size={16} />
              الرئيسية
            </Link>
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

          {/* العنوان */}
          <div className="text-center pb-8" dir="rtl">
            <h1 className="text-4xl font-bold text-white mb-3">
              سوق الخدمات
            </h1>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              اكتشف مجموعة متكاملة من الخدمات الاحترافية لدعم أعمالك ونمو
              شركتك
            </p>
          </div>

          {/* شريط البحث */}
          <div className="max-w-2xl mx-auto pb-4" dir="rtl">
            <div className="relative">
              <Search
                size={20}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: "#C9A84C" }}
              />
              <input
                type="text"
                placeholder="ابحث عن خدمة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-12 pl-4 py-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/40 outline-none transition-all focus:bg-white/15 focus:border-[#C9A84C]/50"
              />
            </div>
          </div>
        </div>
      </header>

      {/* المحتوى */}
      <main className="max-w-7xl mx-auto px-6 py-10" dir="rtl">
        {/* فلاتر التصنيف */}
        <div className="flex flex-wrap gap-3 mb-10 justify-center">
          <button
            onClick={() => setActiveCategory("الكل")}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={
              activeCategory === "الكل"
                ? {
                    backgroundColor: "#5E5495",
                    color: "#C9A84C",
                    boxShadow: "0 4px 15px rgba(27, 42, 74, 0.3)",
                  }
                : {
                    backgroundColor: "white",
                    color: "#2D3748",
                    border: "1px solid #E2E0D8",
                  }
            }
          >
            الكل
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              style={
                activeCategory === cat
                  ? {
                      backgroundColor: "#5E5495",
                      color: "#C9A84C",
                      boxShadow: "0 4px 15px rgba(27, 42, 74, 0.3)",
                    }
                  : {
                      backgroundColor: "white",
                      color: "#2D3748",
                      border: "1px solid #E2E0D8",
                    }
              }
            >
              {cat}
            </button>
          ))}
        </div>

        {/* شبكة الخدمات */}
        {loading ? (
          <div className="flex justify-center py-20">
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
              <p style={{ color: "#2D3748", opacity: 0.6 }}>
                جارٍ تحميل الخدمات...
              </p>
            </div>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-20">
            <Briefcase
              size={48}
              className="mx-auto mb-4"
              style={{ color: "#C9A84C", opacity: 0.5 }}
            />
            <p className="text-lg font-medium" style={{ color: "#2D3748" }}>
              لا توجد خدمات مطابقة
            </p>
            <p
              className="text-sm mt-1"
              style={{ color: "#2D3748", opacity: 0.5 }}
            >
              جرّب تغيير معايير البحث أو التصنيف
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className="group bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
                style={{
                  border: "1px solid #E2E0D8",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 12px 30px rgba(27, 42, 74, 0.12)";
                  e.currentTarget.style.borderColor = "#C9A84C";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 2px 10px rgba(0,0,0,0.04)";
                  e.currentTarget.style.borderColor = "#E8E6F0";
                }}
              >
                {/* رأس البطاقة */}
                <div
                  className="p-6 flex items-center gap-4"
                  style={{ borderBottom: "1px solid #F0EDE6" }}
                >
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: "rgba(27, 42, 74, 0.06)",
                      color: "#1C1B2E",
                    }}
                  >
                    {getCategoryIcon(service.category)}
                  </div>
                  <div>
                    <h3
                      className="text-lg font-bold"
                      style={{ color: "#1C1B2E" }}
                    >
                      {service.name}
                    </h3>
                    {service.category && (
                      <span
                        className="inline-flex items-center gap-1 text-xs mt-1"
                        style={{ color: "#C9A84C" }}
                      >
                        <Tag size={12} />
                        {service.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* الوصف */}
                <div className="p-6 pb-4">
                  <p
                    className="text-sm leading-relaxed line-clamp-3"
                    style={{ color: "#2D3748", opacity: 0.7 }}
                  >
                    {service.description}
                  </p>
                </div>

                {/* المعلومات والزر */}
                <div className="px-6 pb-6">
                  <div className="flex items-center justify-between mb-4">
                    {service.price && (
                      <div className="flex items-center gap-1.5">
                        <DollarSign size={16} style={{ color: "#C9A84C" }} />
                        <span
                          className="text-lg font-bold"
                          style={{ color: "#1C1B2E" }}
                        >
                          {service.price.toLocaleString("en-US")}
                        </span>
                        <SarSymbol size={12} />
                      </div>
                    )}
                    {service.duration && (
                      <div
                        className="flex items-center gap-1.5 text-sm"
                        style={{ color: "#2D3748", opacity: 0.6 }}
                      >
                        <Clock size={14} />
                        <span>{service.duration} يوم</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Link
                      href={`/services/${service.id}`}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-center transition-all duration-200"
                      style={{
                        backgroundColor: "#5E5495",
                        color: "white",
                        boxShadow: "0 4px 12px rgba(27, 42, 74, 0.25)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#243557";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#1C1B2E";
                      }}
                    >
                      اطلب الخدمة
                    </Link>
                    <Link
                      href={`/services/${service.id}`}
                      className="px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                      style={{
                        border: "1.5px solid #E2E0D8",
                        color: "#2D3748",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#C9A84C";
                        e.currentTarget.style.color = "#C9A84C";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#E8E6F0";
                        e.currentTarget.style.color = "#2D3748";
                      }}
                    >
                      التفاصيل
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* الفوتر */}
      <footer className="mt-16 py-8" style={{ borderTop: "1px solid #E2E0D8" }}>
        <div className="text-center">
          <p className="text-xs" style={{ color: "#2D3748", opacity: 0.4 }}>
            &copy; 2024 مرسى. جميع الحقوق محفوظة
          </p>
        </div>
      </footer>
    </div>
  );
}
