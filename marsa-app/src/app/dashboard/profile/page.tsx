"use client";

import { useState, useEffect, useRef } from "react";
import {
  User, Lock, Save, Loader2, CheckCircle, AlertCircle,
  Mail, Shield, Phone, Image, Eye, EyeOff, PenTool, Stamp, Trash2,
} from "lucide-react";
import { UploadButton } from "@/lib/uploadthing";
import { MarsaButton } from "@/components/ui/MarsaButton";
import SignaturePad from "signature_pad";

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  role: string;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  ADMIN: "مدير النظام",
  MANAGER: "مشرف",
  CLIENT: "عميل",
  EXECUTOR: "منفذ",
  EXTERNAL_PROVIDER: "مقدم خدمة خارجي",
  FINANCE_MANAGER: "مدير مالي",
  TREASURY_MANAGER: "أمين صندوق",
};

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"info" | "password" | "signature">("info");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Info form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saving, setSaving] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Signature & Stamp
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [stampImage, setStampImage] = useState<string | null>(null);
  const [savingSignature, setSavingSignature] = useState(false);

  // Messages
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => { document.title = "الملف الشخصي | مرسى"; }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/profile/signature").then((r) => r.json()),
    ])
      .then(([data, sigData]) => {
        if (data.id) {
          setProfile(data);
          setName(data.name);
          setPhone(data.phone || "");
          setAvatar(data.avatar || "");
        }
        if (sigData.signatureImage) setSignatureImage(sigData.signatureImage);
        if (sigData.stampImage) setStampImage(sigData.stampImage);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const showMessage = (type: "success" | "error", msg: string) => {
    if (type === "success") {
      setSuccessMsg(msg);
      setErrorMsg("");
    } else {
      setErrorMsg(msg);
      setSuccessMsg("");
    }
    setTimeout(() => {
      setSuccessMsg("");
      setErrorMsg("");
    }, 4000);
  };

  const handleSaveInfo = async () => {
    if (!name.trim()) {
      showMessage("error", "الاسم مطلوب");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, avatar }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
        showMessage("success", "تم حفظ التغييرات بنجاح");
      } else {
        showMessage("error", data.error || "حدث خطأ");
      }
    } catch {
      showMessage("error", "حدث خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setChangingPassword(true);
    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        showMessage("success", data.message || "تم تغيير كلمة المرور بنجاح");
      } else {
        showMessage("error", data.error || "حدث خطأ");
      }
    } catch {
      showMessage("error", "حدث خطأ في الاتصال");
    } finally {
      setChangingPassword(false);
    }
  };

  // ─── SignaturePad initialization ───
  useEffect(() => {
    if (activeTab === "signature" && !signatureImage) {
      // Wait for canvas to render
      const timer = setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Set canvas size based on display size (for retina)
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(ratio, ratio);

        // Destroy old instance if exists
        if (sigPadRef.current) {
          sigPadRef.current.off();
        }

        sigPadRef.current = new SignaturePad(canvas, {
          penColor: "#1C1B2E",
          backgroundColor: "rgba(0,0,0,0)",
        });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab, signatureImage]);

  const clearCanvas = () => {
    sigPadRef.current?.clear();
  };

  const saveSignatureFromCanvas = () => {
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      showMessage("error", "الرجاء رسم التوقيع أولاً");
      return;
    }
    const dataUrl = sigPadRef.current.toDataURL("image/png");
    setSignatureImage(dataUrl);
  };

  const handleSaveSignature = async () => {
    setSavingSignature(true);
    try {
      const res = await fetch("/api/profile/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureImage, stampImage }),
      });
      if (res.ok) {
        showMessage("success", "تم حفظ التوقيع والختم بنجاح");
      } else {
        const data = await res.json();
        showMessage("error", data.error || "حدث خطأ");
      }
    } catch {
      showMessage("error", "حدث خطأ في الاتصال");
    } finally {
      setSavingSignature(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={40} className="animate-spin" style={{ color: "#1C1B2E" }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <p style={{ color: "#2D3748" }}>تعذر تحميل الملف الشخصي</p>
      </div>
    );
  }

  const initials = profile.name
    .split(" ")
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join("");

  return (
    <div className="p-8 max-w-3xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
          الملف الشخصي
        </h1>
        <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>
          إدارة معلوماتك الشخصية وكلمة المرور
        </p>
      </div>

      {/* Avatar Header Card */}
      <div
        className="bg-white rounded-2xl p-6 mb-6 flex items-center gap-5"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        {profile.avatar ? (
          <img
            src={profile.avatar}
            alt={profile.name}
            className="w-20 h-20 rounded-full object-cover"
            style={{ border: "3px solid #C9A84C" }}
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
            style={{ backgroundColor: "rgba(201,168,76,0.12)", color: "#C9A84C", border: "3px solid #C9A84C" }}
          >
            {initials}
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold" style={{ color: "#1C1B2E" }}>
            {profile.name}
          </h2>
          <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
            {profile.email}
          </p>
          <span
            className="inline-block mt-2 px-3 py-1 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: "rgba(201,168,76,0.12)", color: "#C9A84C" }}
          >
            {roleLabels[profile.role] || profile.role}
          </span>
        </div>
      </div>

      {/* Toast Messages */}
      {successMsg && (
        <div
          className="flex items-center gap-2 p-4 rounded-xl mb-6"
          style={{ backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0" }}
        >
          <CheckCircle size={18} style={{ color: "#059669" }} />
          <span className="text-sm font-medium" style={{ color: "#059669" }}>
            {successMsg}
          </span>
        </div>
      )}
      {errorMsg && (
        <div
          className="flex items-center gap-2 p-4 rounded-xl mb-6"
          style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}
        >
          <AlertCircle size={18} style={{ color: "#DC2626" }} />
          <span className="text-sm font-medium" style={{ color: "#DC2626" }}>
            {errorMsg}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6"
        style={{ backgroundColor: "#F0EEF5" }}
      >
        <button
          onClick={() => setActiveTab("info")}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all"
          style={
            activeTab === "info"
              ? { backgroundColor: "#FFFFFF", color: "#1C1B2E", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }
              : { backgroundColor: "transparent", color: "#94A3B8" }
          }
        >
          <User size={16} />
          المعلومات الشخصية
        </button>
        <button
          onClick={() => setActiveTab("password")}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all"
          style={
            activeTab === "password"
              ? { backgroundColor: "#FFFFFF", color: "#1C1B2E", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }
              : { backgroundColor: "transparent", color: "#94A3B8" }
          }
        >
          <Lock size={16} />
          تغيير كلمة المرور
        </button>
        <button
          onClick={() => setActiveTab("signature")}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all"
          style={
            activeTab === "signature"
              ? { backgroundColor: "#FFFFFF", color: "#1C1B2E", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }
              : { backgroundColor: "transparent", color: "#94A3B8" }
          }
        >
          <PenTool size={16} />
          التوقيع والختم
        </button>
      </div>

      {/* Tab Content */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        {activeTab === "signature" ? (
          <div className="space-y-6">
            {/* Signature Pad */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: "#1C1B2E" }}>
                <PenTool size={14} style={{ color: "#C9A84C" }} />
                التوقيع
              </label>
              {signatureImage ? (
                <div className="space-y-3">
                  <div className="rounded-xl p-4 flex items-center justify-center" style={{ backgroundColor: "#FAFAFE", border: "1px solid #E2E0D8" }}>
                    <img src={signatureImage} alt="التوقيع" className="max-h-32 object-contain" />
                  </div>
                  <button
                    onClick={() => { setSignatureImage(null); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                    style={{ color: "#DC2626", border: "1px solid #FECACA", backgroundColor: "#FEF2F2" }}
                  >
                    <Trash2 size={14} /> حذف التوقيع
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
                    <canvas
                      ref={canvasRef}
                      className="w-full cursor-crosshair"
                      style={{ height: "180px", backgroundColor: "#FAFAFE", touchAction: "none" }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <MarsaButton onClick={saveSignatureFromCanvas} variant="gold" size="sm" icon={<CheckCircle size={14} />} style={{ backgroundColor: "#059669" }}>
                      اعتماد التوقيع
                    </MarsaButton>
                    <MarsaButton onClick={clearCanvas} variant="secondary" size="sm" icon={<Trash2 size={14} />}>
                      مسح
                    </MarsaButton>
                  </div>
                  <p className="text-xs" style={{ color: "#94A3B8" }}>ارسم توقيعك في المربع أعلاه ثم اضغط &quot;اعتماد التوقيع&quot;</p>
                </div>
              )}
            </div>

            {/* Stamp Upload */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: "#1C1B2E" }}>
                <Stamp size={14} style={{ color: "#C9A84C" }} />
                الختم
              </label>
              {stampImage ? (
                <div className="space-y-3">
                  <div className="rounded-xl p-4 flex items-center justify-center" style={{ backgroundColor: "#FAFAFE", border: "1px solid #E2E0D8" }}>
                    <img src={stampImage} alt="الختم" className="max-h-32 object-contain" />
                  </div>
                  <button
                    onClick={() => setStampImage(null)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                    style={{ color: "#DC2626", border: "1px solid #FECACA", backgroundColor: "#FEF2F2" }}
                  >
                    <Trash2 size={14} /> حذف الختم
                  </button>
                </div>
              ) : (
                <div>
                  <UploadButton
                    endpoint="avatarUploader"
                    onClientUploadComplete={(res) => {
                      if (res?.[0]) setStampImage(res[0].ufsUrl);
                    }}
                    onUploadError={(error) => {
                      showMessage("error", "خطأ في الرفع: " + error.message);
                    }}
                    appearance={{
                      button: { backgroundColor: "#5E5495", color: "white", borderRadius: "0.75rem", fontSize: "0.875rem" },
                      allowedContent: { color: "#6B7280", fontSize: "0.75rem" },
                    }}
                    content={{
                      button: () => "رفع صورة الختم",
                      allowedContent: () => "صورة PNG شفافة (2MB كحد أقصى)",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Save Button */}
            <MarsaButton onClick={handleSaveSignature} disabled={savingSignature} variant="gold" size="lg" loading={savingSignature} icon={!savingSignature ? <Save size={18} /> : undefined} className="w-full">
              حفظ التوقيع والختم
            </MarsaButton>
          </div>
        ) : activeTab === "info" ? (
          <div className="space-y-5">
            {/* Name */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#1C1B2E" }}>
                <User size={14} style={{ color: "#C9A84C" }} />
                الاسم
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                style={{
                  border: "1px solid #E2E0D8",
                  color: "#2D3748",
                  backgroundColor: "#FFFFFF",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#1C1B2E" }}>
                <Phone size={14} style={{ color: "#C9A84C" }} />
                رقم الجوال
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                style={{
                  border: "1px solid #E2E0D8",
                  color: "#2D3748",
                  backgroundColor: "#FFFFFF",
                }}
                placeholder="05xxxxxxxx"
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
              />
            </div>

            {/* Avatar Upload */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#1C1B2E" }}>
                <Image size={14} style={{ color: "#C9A84C" }} />
                الصورة الرمزية
              </label>
              {avatar && (
                <img
                  src={avatar}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover mb-2"
                  style={{ border: "2px solid #E2E0D8" }}
                />
              )}
              <UploadButton
                endpoint="avatarUploader"
                onClientUploadComplete={(res) => {
                  if (res?.[0]) setAvatar(res[0].ufsUrl);
                }}
                onUploadError={(error) => {
                  alert("خطأ في الرفع: " + error.message);
                }}
                appearance={{
                  button: { backgroundColor: "#C9A84C", color: "white", borderRadius: "0.75rem", fontSize: "0.875rem" },
                  allowedContent: { color: "#6B7280", fontSize: "0.75rem" },
                }}
                content={{
                  button: () => "رفع صورة",
                  allowedContent: () => "صورة (2MB كحد أقصى)",
                }}
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#1C1B2E" }}>
                <Mail size={14} style={{ color: "#C9A84C" }} />
                البريد الإلكتروني
              </label>
              <input
                type="text"
                value={profile.email}
                readOnly
                className="w-full px-4 py-3 rounded-xl text-sm cursor-not-allowed"
                style={{
                  border: "1px solid #E2E0D8",
                  color: "#94A3B8",
                  backgroundColor: "#F8F9FA",
                }}
                dir="ltr"
              />
            </div>

            {/* Role (read-only) */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#1C1B2E" }}>
                <Shield size={14} style={{ color: "#C9A84C" }} />
                الدور
              </label>
              <input
                type="text"
                value={roleLabels[profile.role] || profile.role}
                readOnly
                className="w-full px-4 py-3 rounded-xl text-sm cursor-not-allowed"
                style={{
                  border: "1px solid #E2E0D8",
                  color: "#94A3B8",
                  backgroundColor: "#F8F9FA",
                }}
              />
            </div>

            {/* Save Button */}
            <MarsaButton onClick={handleSaveInfo} disabled={saving} variant="gold" size="lg" loading={saving} icon={!saving ? <Save size={18} /> : undefined} className="w-full">
              حفظ التغييرات
            </MarsaButton>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Current Password */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#1C1B2E" }}>
                <Lock size={14} style={{ color: "#C9A84C" }} />
                كلمة المرور الحالية
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                  style={{
                    border: "1px solid #E2E0D8",
                    color: "#2D3748",
                    backgroundColor: "#FFFFFF",
                  }}
                  dir="ltr"
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#94A3B8" }}
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#1C1B2E" }}>
                <Lock size={14} style={{ color: "#C9A84C" }} />
                كلمة المرور الجديدة
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                  style={{
                    border: "1px solid #E2E0D8",
                    color: "#2D3748",
                    backgroundColor: "#FFFFFF",
                  }}
                  dir="ltr"
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#94A3B8" }}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#1C1B2E" }}>
                <Lock size={14} style={{ color: "#C9A84C" }} />
                تأكيد كلمة المرور الجديدة
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                  style={{
                    border: "1px solid #E2E0D8",
                    color: "#2D3748",
                    backgroundColor: "#FFFFFF",
                  }}
                  dir="ltr"
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#94A3B8" }}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Change Password Button */}
            <MarsaButton onClick={handleChangePassword} disabled={changingPassword} variant="primary" size="lg" loading={changingPassword} icon={!changingPassword ? <Lock size={18} /> : undefined} className="w-full">
              تغيير كلمة المرور
            </MarsaButton>
          </div>
        )}
      </div>
    </div>
  );
}
