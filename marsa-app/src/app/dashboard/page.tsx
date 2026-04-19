"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import ClientDashboard from "./ClientDashboard";
import AdminDashboard from "./AdminDashboard";
import EmployeeDashboard from "./EmployeeDashboard";
import ProviderDashboard from "./ProviderDashboard";
import ProjectHealthRadar from "@/components/ProjectHealthRadar";
import PrayerTimesCard from "@/components/PrayerTimesCard";
import LeaderboardWidget from "@/components/LeaderboardWidget";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "الشاشة الرئيسية | مرسى"; }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/dashboard")
        .then((r) => r.json())
        .then((d) => { setData(d); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [status]);

  if (status === "loading") return null;
  if (!session) redirect("/auth/login");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#1C1B2E" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="#1C1B2E" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p style={{ color: "#2D3748", opacity: 0.6 }}>جارٍ تحميل الشاشة الرئيسية...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const role = session.user.role;

  if (role === "ADMIN" || role === "MANAGER") {
    return (
      <>
        <div className="px-4 md:px-8 pt-4 md:pt-6">
          <PrayerTimesCard />
        </div>
        <AdminDashboard data={data} userName={session.user.name || "مستخدم"} />
        <div className="p-4 md:p-8 pt-0">
          <ProjectHealthRadar compact />
        </div>
      </>
    );
  }

  if (role === "EXECUTOR") {
    return (
      <div className="p-4 md:p-8" dir="rtl">
        <PrayerTimesCard />
        <div className="mt-6 mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            مرحباً {session.user.name || "مستخدم"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            نظرة عامة على صحة مشاريعك
          </p>
        </div>
        <ProjectHealthRadar />
        <div className="mt-6">
          <LeaderboardWidget />
        </div>
      </div>
    );
  }

  if (role === "EXTERNAL_PROVIDER") {
    return (
      <>
        <div className="px-4 md:px-8 pt-4 md:pt-6">
          <PrayerTimesCard />
        </div>
        <ProviderDashboard data={data} userName={session.user.name || "مستخدم"} />
      </>
    );
  }

  return <ClientDashboard userName={session.user.name || "مستخدم"} />;
}
