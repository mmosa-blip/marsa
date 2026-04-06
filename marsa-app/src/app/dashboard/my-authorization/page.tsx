"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import SignaturePad from "signature_pad";
import {
  Shield,
  ShieldAlert,
  ShieldOff,
  CheckCircle2,
  Loader2,
  PenTool,
  RotateCcw,
  Calendar,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { MarsaButton } from "@/components/ui/MarsaButton";

type AuthType = "FULL" | "PER_SERVICE" | "NONE";

const authConfig: Record<AuthType, { label: string; labelEn: string; desc: string; descEn: string; icon: typeof Shield; color: string; bg: string }> = {
  FULL: {
    label: "تفويض شامل",
    labelEn: "Full Authorization",
    desc: "أفوّض شركة مرسى بالوصول الكامل لجميع بياناتي وخدماتي والتصرف نيابةً عني",
    descEn: "I authorize Marsa to fully access all my data and services and act on my behalf",
    icon: Shield,
    color: "#059669",
    bg: "rgba(5,150,105,0.08)",
  },
  PER_SERVICE: {
    label: "تفويض لكل خدمة",
    labelEn: "Per-Service Authorization",
    desc: "أفوّض شركة مرسى بالوصول لبياناتي مع طلب موافقتي عبر رمز التحقق لكل خدمة",
    descEn: "I authorize Marsa to access my data with OTP verification required for each service",
    icon: ShieldAlert,
    color: "#C9A84C",
    bg: "rgba(201,168,76,0.1)",
  },
  NONE: {
    label: "بدون تفويض",
    labelEn: "No Authorization",
    desc: "لا أرغب بتفويض أي صلاحيات حالياً",
    descEn: "I do not wish to grant any authorization at this time",
    icon: ShieldOff,
    color: "#94A3B8",
    bg: "rgba(148,163,184,0.1)",
  },
};

export default function MyAuthorizationPage() {
  const { data: session } = useSession();
  const { t, lang } = useLang();
  const isAr = lang === "ar";

  const [currentAuth, setCurrentAuth] = useState<AuthType>("NONE");
  const [grantedAt, setGrantedAt] = useState<string | null>(null);
  const [selectedAuth, setSelectedAuth] = useState<AuthType>("NONE");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Signature pad
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);
  const [signatureReady, setSignatureReady] = useState(false);

  // Load current authorization
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/clients/${session.user.id}/authorization`)
      .then((r) => r.json())
      .then((data) => {
        setCurrentAuth(data.authorizationType || "NONE");
        setSelectedAuth(data.authorizationType || "NONE");
        setGrantedAt(data.authorizationGrantedAt || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.user?.id]);

  // Initialize signature pad
  useEffect(() => {
    if (canvasRef.current && !sigPadRef.current) {
      const canvas = canvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);

      sigPadRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "#1C1B2E",
      });

      sigPadRef.current.addEventListener("endStroke", () => {
        setSignatureReady(!sigPadRef.current!.isEmpty());
      });
    }
  }, [loading]);

  const clearSignature = () => {
    sigPadRef.current?.clear();
    setSignatureReady(false);
  };

  const handleSubmit = async () => {
    if (!session?.user?.id) return;
    setError("");
    setSuccess(false);

    if (selectedAuth !== "NONE" && (!sigPadRef.current || sigPadRef.current.isEmpty())) {
      setError(isAr ? "يرجى التوقيع قبل إرسال التفويض" : "Please sign before submitting");
      return;
    }

    setSaving(true);
    try {
      const signature = selectedAuth !== "NONE" ? sigPadRef.current?.toDataURL("image/png") : null;

      const res = await fetch(`/api/clients/${session.user.id}/authorization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorizationType: selectedAuth, signature }),
      });

      const data = await res.json();
      if (res.ok) {
        setCurrentAuth(selectedAuth);
        setGrantedAt(data.authorizationGrantedAt || null);
        setSuccess(true);
        if (selectedAuth === "NONE") clearSignature();
      } else {
        setError(data.error || (isAr ? "حدث خطأ" : "An error occurred"));
      }
    } catch {
      setError(isAr ? "حدث خطأ في الاتصال" : "Connection error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={40} className="animate-spin" style={{ color: "#5E5495" }} />
      </div>
    );
  }

  const currentConfig = authConfig[currentAuth];
  const CurrentIcon = currentConfig.icon;
  const hasChanged = selectedAuth !== currentAuth;
  const needsSignature = selectedAuth !== "NONE";

  return (
    <div className="p-8 max-w-3xl" dir={isAr ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "rgba(94,84,149,0.12)" }}
        >
          <Shield size={24} style={{ color: "#5E5495" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            {isAr ? "التفويض" : "Authorization"}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
            {isAr
              ? "إدارة تفويض الصلاحيات لشركة مرسى للعمل نيابةً عنك"
              : "Manage authorization for Marsa to act on your behalf"}
          </p>
        </div>
      </div>

      {/* Current Status */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{ backgroundColor: currentConfig.bg, border: `1px solid ${currentConfig.color}30` }}
      >
        <div className="flex items-center gap-3 mb-2">
          <CurrentIcon size={20} style={{ color: currentConfig.color }} />
          <span className="text-sm font-bold" style={{ color: currentConfig.color }}>
            {isAr ? "الحالة الحالية" : "Current Status"}
          </span>
        </div>
        <p className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
          {isAr ? currentConfig.label : currentConfig.labelEn}
        </p>
        {grantedAt && (
          <div className="flex items-center gap-1.5 mt-2">
            <Calendar size={14} style={{ color: "#6B7280" }} />
            <span className="text-xs" style={{ color: "#6B7280" }}>
              {isAr ? "تاريخ التفويض:" : "Granted on:"}{" "}
              {new Date(grantedAt).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
                year: "numeric",
                month: "long",
                day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}
      </div>

      {/* Success Message */}
      {success && (
        <div
          className="mb-6 p-4 rounded-xl flex items-center gap-3"
          style={{ backgroundColor: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.2)" }}
        >
          <CheckCircle2 size={20} style={{ color: "#059669" }} />
          <p className="text-sm font-medium" style={{ color: "#059669" }}>
            {isAr ? "تم تحديث التفويض بنجاح" : "Authorization updated successfully"}
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          className="mb-6 p-4 rounded-xl flex items-center gap-3"
          style={{ backgroundColor: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)" }}
        >
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(220,38,38,0.1)" }}>
            <span className="text-red-600 text-xs font-bold">!</span>
          </div>
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      {/* Authorization Type Selection */}
      <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: "1px solid #E2E0D8" }}>
        <h2 className="text-base font-bold mb-2" style={{ color: "#1C1B2E" }}>
          {isAr ? "اختر نوع التفويض" : "Choose Authorization Type"}
        </h2>
        <p className="text-sm mb-5" style={{ color: "#6B7280" }}>
          {isAr
            ? "حدد مستوى الصلاحيات التي ترغب بمنحها لمرسى"
            : "Select the level of access you wish to grant to Marsa"}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(authConfig) as AuthType[]).map((type) => {
            const config = authConfig[type];
            const isSelected = selectedAuth === type;
            const Icon = config.icon;
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setSelectedAuth(type);
                  setSuccess(false);
                  setError("");
                }}
                className="p-5 rounded-xl transition-all text-start"
                style={{
                  border: isSelected ? `2px solid ${config.color}` : "2px solid #E2E0D8",
                  backgroundColor: isSelected ? config.bg : "transparent",
                }}
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: isSelected ? `${config.color}20` : "rgba(148,163,184,0.1)" }}
                  >
                    <Icon size={20} style={{ color: isSelected ? config.color : "#94A3B8" }} />
                  </div>
                  <span
                    className="text-sm font-bold"
                    style={{ color: isSelected ? config.color : "#2D3748" }}
                  >
                    {isAr ? config.label : config.labelEn}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
                  {isAr ? config.desc : config.descEn}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Signature Pad — only shown when granting authorization */}
      {needsSignature && hasChanged && (
        <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: "1px solid #E2E0D8" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PenTool size={18} style={{ color: "#5E5495" }} />
              <h2 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
                {isAr ? "التوقيع" : "Signature"}
              </h2>
            </div>
            <button
              onClick={clearSignature}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-gray-100"
              style={{ color: "#6B7280" }}
            >
              <RotateCcw size={14} />
              {isAr ? "مسح" : "Clear"}
            </button>
          </div>
          <p className="text-sm mb-4" style={{ color: "#6B7280" }}>
            {isAr
              ? "وقّع أدناه لتأكيد موافقتك على التفويض"
              : "Sign below to confirm your authorization"}
          </p>
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "2px dashed #E2E0D8", backgroundColor: "#FAFAFE" }}
          >
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ height: 200, touchAction: "none" }}
            />
          </div>
        </div>
      )}

      {/* Submit Button */}
      {hasChanged && (
        <div className="flex items-center gap-3">
          <MarsaButton
            onClick={handleSubmit}
            disabled={saving || (needsSignature && !signatureReady)}
            variant="primary" size="lg" loading={saving}
            icon={!saving ? <CheckCircle2 size={18} /> : undefined}
          >
            {saving ? (isAr ? "جارٍ الحفظ..." : "Saving...") : selectedAuth === "NONE"
              ? (isAr ? "إلغاء التفويض" : "Revoke Authorization")
              : (isAr ? "تأكيد التفويض" : "Confirm Authorization")}
          </MarsaButton>
          <MarsaButton
            onClick={() => {
              setSelectedAuth(currentAuth);
              setError("");
              setSuccess(false);
              clearSignature();
            }}
            variant="secondary" size="lg"
          >
            {isAr ? "إلغاء" : "Cancel"}
          </MarsaButton>
        </div>
      )}
    </div>
  );
}
