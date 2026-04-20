"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowRight, ArrowLeft, Search, UserPlus, Package, ShoppingCart,
  Banknote, CreditCard, Building2, Clock, CheckCircle, Printer,
  RotateCcw, Plus, Minus, Trash2, X,
} from "lucide-react";
import MarsaLogo from "@/components/MarsaLogo";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";

// ===== Types =====
interface ClientResult {
  id: string; name: string; email: string; phone: string | null;
  companyName: string | null;
}

interface ServiceCatalog {
  id: string; name: string; price: number | null; category: string | null;
}

interface CartItem {
  id: string; name: string; price: number; quantity: number; category: string | null;
}

interface TransactionResult {
  id: string; transactionNumber: string; grandTotal: number;
  paymentMethod: string; changeAmount: number | null;
  invoiceNumber: string;
}

interface ReceiptData {
  transactionNumber: string; createdAt: string;
  client: { name: string; phone: string | null };
  cashier: { name: string };
  invoice: {
    invoiceNumber: string;
    items: { description: string; quantity: number; unitPrice: number; total: number }[];
    company: { name: string };
  };
  totalAmount: number; taxAmount: number; grandTotal: number;
  paymentMethod: string; amountReceived: number | null; changeAmount: number | null;
}

const paymentMethods = [
  { id: "CASH", label: "نقدي", icon: Banknote, color: "#059669", bg: "rgba(5,150,105,0.15)" },
  { id: "MADA", label: "شبكة / مدى", icon: CreditCard, color: "#2563EB", bg: "rgba(37,99,235,0.15)" },
  { id: "BANK_TRANSFER", label: "تحويل بنكي", icon: Building2, color: "#7C3AED", bg: "rgba(124,58,237,0.15)" },
  { id: "DEFERRED", label: "آجل", icon: Clock, color: "#EA580C", bg: "rgba(234,88,12,0.15)" },
];

const paymentLabels: Record<string, string> = { CASH: "نقدي", MADA: "شبكة / مدى", BANK_TRANSFER: "تحويل بنكي", DEFERRED: "آجل" };

export default function CashierPage() {
  const [step, setStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);
  const [mode, setMode] = useState<"single" | "multi" | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPayment, setSelectedPayment] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [processing, setProcessing] = useState(false);
  const [txnResult, setTxnResult] = useState<TransactionResult | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // ===== Step 1 State =====
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", phone: "", email: "", companyName: "" });
  const [creatingClient, setCreatingClient] = useState(false);
  // One-time plaintext password shown to the cashier after quick-create.
  // Cleared when the cashier dismisses the banner — never sent again.
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  // ===== Step 2 State =====
  const [services, setServices] = useState<ServiceCatalog[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  // البحث عن العملاء
  useEffect(() => {
    if (!clientSearch || clientSearch.length < 2) { setClientResults([]); return; }
    const timer = setTimeout(() => {
      setSearchLoading(true);
      fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}`)
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d)) setClientResults(d); setSearchLoading(false); })
        .catch(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  // جلب الخدمات
  useEffect(() => {
    if (step === 2 && mode) {
      fetch("/api/services")
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d)) setServices(d); });
    }
  }, [step, mode]);

  // Focus على حقل البحث
  useEffect(() => {
    if (step === 1) setTimeout(() => searchRef.current?.focus(), 100);
  }, [step]);

  const subtotal = cart.reduce((s, item) => s + item.price * item.quantity, 0);
  const taxAmount = subtotal * 0.15;
  const grandTotal = subtotal + taxAmount;
  const change = selectedPayment === "CASH" && amountReceived ? parseFloat(amountReceived) - grandTotal : 0;

  const selectClient = (c: ClientResult) => {
    setSelectedClient(c);
    setStep(2);
  };

  const addToCart = (svc: ServiceCatalog) => {
    const existing = cart.find((c) => c.id === svc.id);
    if (existing) {
      setCart(cart.map((c) => c.id === svc.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { id: svc.id, name: svc.name, price: svc.price || 0, quantity: 1, category: svc.category }]);
    }
  };

  const selectSingle = (svc: ServiceCatalog) => {
    setCart([{ id: svc.id, name: svc.name, price: svc.price || 0, quantity: 1, category: svc.category }]);
    setStep(3);
  };

  const updateQty = (id: string, delta: number) => {
    setCart(cart.map((c) => c.id === id ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  };

  const updatePrice = (id: string, price: number) => {
    setCart(cart.map((c) => c.id === id ? { ...c, price } : c));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((c) => c.id !== id));
  };

  const handleCreateClient = async () => {
    if (!newClient.name) return;
    setCreatingClient(true);
    try {
      // Server-side generates the random password and attaches the
      // company in a single request. The password comes back once so we
      // can show it to the cashier — they must hand it to the client
      // before closing this dialog.
      const res = await fetch("/api/clients/quick-create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClient.name,
          email: newClient.email || `${Date.now()}@temp.marsa.sa`,
          phone: newClient.phone || null,
          companyName: newClient.companyName || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const user = data.user;
        setGeneratedPassword(data.password);
        selectClient({ id: user.id, name: user.name, email: user.email, phone: newClient.phone, companyName: newClient.companyName || null });
        setShowNewClient(false);
        setNewClient({ name: "", phone: "", email: "", companyName: "" });
      }
    } catch { /* ignore */ }
    setCreatingClient(false);
  };

  const confirmTransaction = async () => {
    if (!selectedClient || cart.length === 0 || !selectedPayment) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/cashier/transaction", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          services: cart.map((c) => ({ id: c.id, name: c.name, price: c.price, quantity: c.quantity, category: c.category })),
          paymentMethod: selectedPayment,
          amountReceived: amountReceived ? parseFloat(amountReceived) : null,
          referenceNumber: referenceNumber || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTxnResult(data);
        // جلب بيانات الإيصال
        const receiptRes = await fetch(`/api/cashier/receipt/${data.id}`);
        if (receiptRes.ok) setReceiptData(await receiptRes.json());
        setStep(4);
      }
    } catch { /* ignore */ }
    setProcessing(false);
  };

  const reset = () => {
    setStep(1); setSelectedClient(null); setMode(null); setCart([]);
    setSelectedPayment(""); setAmountReceived(""); setReferenceNumber("");
    setTxnResult(null); setReceiptData(null); setClientSearch(""); setClientResults([]);
  };

  const printReceipt = () => {
    if (!receiptData) return;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>إيصال</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;max-width:350px;margin:0 auto;font-size:13px}
    .center{text-align:center}.bold{font-weight:bold}.line{border-top:1px dashed #000;margin:10px 0}
    .row{display:flex;justify-content:space-between;margin:3px 0}.logo{font-size:24px;color:#C9A84C;margin-bottom:5px}
    .total{font-size:18px;font-weight:bold}table{width:100%;border-collapse:collapse}td,th{padding:4px;text-align:right;font-size:12px}
    th{border-bottom:1px solid #000}@media print{body{padding:5px}}</style></head><body>
    <div class="center"><div class="logo">مرسى</div><p class="bold">إيصال دفع</p></div>
    <div class="line"></div>
    <div class="row"><span>رقم العملية:</span><span class="bold">${receiptData.transactionNumber}</span></div>
    <div class="row"><span>رقم الفاتورة:</span><span>${receiptData.invoice.invoiceNumber}</span></div>
    <div class="row"><span>التاريخ:</span><span>${new Date(receiptData.createdAt).toLocaleDateString("ar-SA-u-nu-latn")} ${new Date(receiptData.createdAt).toLocaleTimeString("ar-SA-u-nu-latn")}</span></div>
    <div class="row"><span>العميل:</span><span class="bold">${receiptData.client.name}</span></div>
    <div class="row"><span>الكاشير:</span><span>${receiptData.cashier.name}</span></div>
    <div class="line"></div>
    <table><thead><tr><th>الخدمة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>
    ${receiptData.invoice.items.map((item) => `<tr><td>${item.description}</td><td style="text-align:center">${item.quantity}</td><td>${item.unitPrice.toLocaleString("en-US")}</td><td>${item.total.toLocaleString("en-US")}</td></tr>`).join("")}
    </tbody></table>
    <div class="line"></div>
    <div class="row"><span>المجموع:</span><span>${receiptData.totalAmount.toLocaleString("en-US")} ر.س</span></div>
    <div class="row"><span>الضريبة (15%):</span><span>${receiptData.taxAmount.toLocaleString("en-US")} ر.س</span></div>
    <div class="line"></div>
    <div class="row"><span class="total">الإجمالي:</span><span class="total">${receiptData.grandTotal.toLocaleString("en-US")} ر.س</span></div>
    <div class="line"></div>
    <div class="row"><span>طريقة الدفع:</span><span>${paymentLabels[receiptData.paymentMethod] || receiptData.paymentMethod}</span></div>
    ${receiptData.amountReceived ? `<div class="row"><span>المبلغ المستلم:</span><span>${receiptData.amountReceived.toLocaleString("en-US")} ر.س</span></div>` : ""}
    ${receiptData.changeAmount ? `<div class="row"><span class="bold">الباقي:</span><span class="bold">${receiptData.changeAmount.toLocaleString("en-US")} ر.س</span></div>` : ""}
    <div class="line"></div>
    <div class="center" style="margin-top:15px;font-size:11px;color:#666">شكراً لتعاملكم معنا<br/>مرسى لإدارة الأعمال</div>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#0F1B2E" }} dir="rtl">
      {/* الشريط العلوي */}
      <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: "#5E5495", borderBottom: "1px solid rgba(201,168,76,0.2)" }}>
        <div className="flex items-center gap-3">
          <MarsaLogo size={28} variant="light" />
          <span className="text-lg font-bold" style={{ color: "#C9A84C" }}>كاشير مرسى</span>
        </div>
        <div className="flex items-center gap-4">
          {/* مؤشر الخطوات */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                  style={step >= s ? { backgroundColor: "#C9A84C", color: "#1C1B2E" } : { backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" }}>
                  {step > s ? "✓" : s}
                </div>
                {s < 3 && <div className="w-8 h-0.5 rounded" style={{ backgroundColor: step > s ? "#C9A84C" : "rgba(255,255,255,0.1)" }} />}
              </div>
            ))}
          </div>
          <MarsaButton href="/dashboard" variant="ghost" size="sm" icon={<ArrowRight size={16} />} style={{ color: "rgba(255,255,255,0.5)" }}>
            رجوع
          </MarsaButton>
        </div>
      </div>

      {/* المحتوى */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ===== الخطوة 1: اختيار العميل ===== */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto pt-12">
            <h2 className="text-3xl font-bold text-center mb-2" style={{ color: "white" }}>اختر العميل</h2>
            <p className="text-center mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>ابحث عن العميل أو أضف عميلاً جديداً</p>

            <div className="relative mb-6">
              <Search size={22} className="absolute right-5 top-1/2 -translate-y-1/2" style={{ color: "#C9A84C" }} />
              <input ref={searchRef} type="text" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)}
                placeholder="ابحث بالاسم أو البريد..."
                className="w-full pr-14 pl-5 py-5 rounded-2xl text-lg outline-none transition-all"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "white", border: "2px solid rgba(201,168,76,0.3)" }}
              />
            </div>

            {/* نتائج البحث */}
            {searchLoading && <p className="text-center py-4" style={{ color: "rgba(255,255,255,0.4)" }}>جارٍ البحث...</p>}
            <div className="space-y-3 mb-6">
              {clientResults.map((c) => (
                <button key={c.id} onClick={() => selectClient(c)}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl transition-all hover:scale-[1.02]"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold shrink-0" style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#C9A84C" }}>
                    {c.name.charAt(0)}
                  </div>
                  <div className="text-right flex-1">
                    <p className="text-lg font-bold" style={{ color: "white" }}>{c.name}</p>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {c.companyName && `${c.companyName} • `}{c.email}
                    </p>
                  </div>
                  <ArrowLeft size={20} style={{ color: "#C9A84C" }} />
                </button>
              ))}
            </div>

            <MarsaButton variant="outline" size="lg" icon={<UserPlus size={24} />} onClick={() => setShowNewClient(true)}
              className="w-full p-5 text-lg"
              style={{ border: "2px dashed rgba(201,168,76,0.4)", color: "#C9A84C", backgroundColor: "transparent" }}>
              عميل جديد
            </MarsaButton>

            {/* نافذة عميل جديد */}
            {showNewClient && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowNewClient(false)}>
                <div className="rounded-2xl w-full max-w-md p-6" style={{ backgroundColor: "#5E5495" }} onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold" style={{ color: "white" }}>عميل جديد</h3>
                    <MarsaButton onClick={() => setShowNewClient(false)} variant="ghost" size="xs" iconOnly icon={<X size={20} />} style={{ color: "rgba(255,255,255,0.4)" }} />
                  </div>
                  <div className="space-y-4">
                    <input type="text" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="اسم العميل *" className="w-full px-4 py-3.5 rounded-xl text-sm outline-none" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(255,255,255,0.15)" }} />
                    <input type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="رقم الجوال" className="w-full px-4 py-3.5 rounded-xl text-sm outline-none" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(255,255,255,0.15)" }} />
                    <input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder="البريد الإلكتروني" className="w-full px-4 py-3.5 rounded-xl text-sm outline-none" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(255,255,255,0.15)" }} />
                    <input type="text" value={newClient.companyName} onChange={(e) => setNewClient({ ...newClient, companyName: e.target.value })} placeholder="اسم الشركة (اختياري)" className="w-full px-4 py-3.5 rounded-xl text-sm outline-none" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(255,255,255,0.15)" }} />
                    <MarsaButton variant="gold" size="lg" onClick={handleCreateClient} disabled={!newClient.name || creatingClient} loading={creatingClient} className="w-full py-4">
                      {creatingClient ? "جارٍ الإنشاء..." : "إضافة العميل"}
                    </MarsaButton>
                  </div>
                </div>
              </div>
            )}

            {/* One-time password banner. Shows after quick-create. The
                cashier must copy/hand it to the client before dismissing —
                the plaintext is not retrievable again. */}
            {generatedPassword && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setGeneratedPassword(null)}>
                <div className="rounded-2xl w-full max-w-md p-6" style={{ backgroundColor: "#1F2937" }} onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-bold mb-3" style={{ color: "#FCD34D" }}>كلمة المرور المؤقتة</h3>
                  <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.7)" }}>
                    انسخ كلمة المرور وسلّمها للعميل. لن تُعرض مرة أخرى. سيُطلب من العميل تغييرها عند أول تسجيل دخول.
                  </p>
                  <div className="rounded-xl px-4 py-3 mb-4 font-mono text-lg text-center" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(252,211,77,0.4)" }}>
                    {generatedPassword}
                  </div>
                  <div className="flex gap-2">
                    <MarsaButton variant="gold" size="md" onClick={() => { navigator.clipboard?.writeText(generatedPassword); }} className="flex-1">
                      نسخ
                    </MarsaButton>
                    <MarsaButton variant="ghost" size="md" onClick={() => setGeneratedPassword(null)} className="flex-1" style={{ color: "white", border: "1px solid rgba(255,255,255,0.2)" }}>
                      تم
                    </MarsaButton>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== الخطوة 2: اختيار الخدمات ===== */}
        {step === 2 && !mode && (
          <div className="max-w-xl mx-auto pt-16">
            <div className="text-center mb-4">
              <p className="text-sm mb-1" style={{ color: "#C9A84C" }}>العميل: {selectedClient?.name}</p>
              <h2 className="text-3xl font-bold" style={{ color: "white" }}>نوع الطلب</h2>
            </div>
            <div className="grid grid-cols-2 gap-6 mt-10">
              <button onClick={() => setMode("single")}
                className="flex flex-col items-center justify-center gap-4 p-10 rounded-3xl transition-all hover:scale-105"
                style={{ backgroundColor: "rgba(201,168,76,0.1)", border: "2px solid rgba(201,168,76,0.3)" }}>
                <Package size={48} style={{ color: "#C9A84C" }} />
                <span className="text-xl font-bold" style={{ color: "white" }}>خدمة واحدة</span>
              </button>
              <button onClick={() => setMode("multi")}
                className="flex flex-col items-center justify-center gap-4 p-10 rounded-3xl transition-all hover:scale-105"
                style={{ backgroundColor: "rgba(37,99,235,0.1)", border: "2px solid rgba(37,99,235,0.3)" }}>
                <ShoppingCart size={48} style={{ color: "#60A5FA" }} />
                <span className="text-xl font-bold" style={{ color: "white" }}>عدة خدمات</span>
              </button>
            </div>
            <MarsaButton variant="ghost" size="sm" icon={<ArrowRight size={16} />} onClick={() => { setStep(1); setSelectedClient(null); }} className="mt-6 mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
              تغيير العميل
            </MarsaButton>
          </div>
        )}

        {step === 2 && mode && (
          <div className={mode === "multi" ? "flex gap-6" : "max-w-4xl mx-auto"}>
            {/* شبكة الخدمات */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm" style={{ color: "#C9A84C" }}>{selectedClient?.name}</p>
                  <h2 className="text-xl font-bold" style={{ color: "white" }}>{mode === "single" ? "اختر الخدمة" : "أضف الخدمات"}</h2>
                </div>
                <MarsaButton variant="ghost" size="sm" onClick={() => setMode(null)} style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  تغيير النوع
                </MarsaButton>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {services.map((svc) => {
                  const inCart = cart.find((c) => c.id === svc.id);
                  return (
                    <button key={svc.id}
                      onClick={() => mode === "single" ? selectSingle(svc) : addToCart(svc)}
                      className="relative p-5 rounded-2xl text-right transition-all hover:scale-[1.03]"
                      style={{
                        backgroundColor: inCart ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.06)",
                        border: inCart ? "2px solid #C9A84C" : "1px solid rgba(255,255,255,0.1)",
                      }}>
                      {inCart && <span className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#C9A84C", color: "#1C1B2E" }}>{inCart.quantity}</span>}
                      <p className="text-sm font-bold mb-1" style={{ color: "white" }}>{svc.name}</p>
                      {svc.category && <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>{svc.category}</p>}
                      <p className="text-lg font-bold" style={{ color: "#C9A84C" }}>
                        {svc.price ? svc.price.toLocaleString("en-US") : "0"} <SarSymbol size={12} />
                      </p>
                      {mode === "multi" && (
                        <div className="mt-2 flex items-center justify-center gap-1 text-xs" style={{ color: "#C9A84C" }}>
                          <Plus size={14} /> إضافة
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* السلة (للعدة خدمات) */}
            {mode === "multi" && (
              <div className="w-80 shrink-0">
                <div className="rounded-2xl p-5 sticky top-0" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <h3 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: "white" }}>
                    <ShoppingCart size={18} style={{ color: "#C9A84C" }} /> السلة ({cart.length})
                  </h3>
                  {cart.length === 0 ? (
                    <p className="text-sm py-8 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>أضف خدمات من القائمة</p>
                  ) : (
                    <>
                      <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                        {cart.map((item) => (
                          <div key={item.id} className="p-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium" style={{ color: "white" }}>{item.name}</p>
                              <button onClick={() => removeFromCart(item.id)}><Trash2 size={14} style={{ color: "#DC2626" }} /></button>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}><Minus size={12} style={{ color: "white" }} /></button>
                                <span className="text-sm font-bold" style={{ color: "white" }}>{item.quantity}</span>
                                <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.2)" }}><Plus size={12} style={{ color: "#C9A84C" }} /></button>
                              </div>
                              <input type="number" value={item.price} onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                                className="w-20 text-left text-sm font-bold px-2 py-1 rounded-lg outline-none" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "#C9A84C", border: "1px solid rgba(255,255,255,0.1)" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                        <div className="flex justify-between text-sm mb-1"><span style={{ color: "rgba(255,255,255,0.5)" }}>المجموع</span><span style={{ color: "white" }}>{subtotal.toLocaleString("en-US")} <SarSymbol size={14} /></span></div>
                        <div className="flex justify-between text-sm mb-2"><span style={{ color: "rgba(255,255,255,0.5)" }}>ضريبة 15%</span><span style={{ color: "white" }}>{taxAmount.toLocaleString("en-US")} <SarSymbol size={14} /></span></div>
                        <div className="flex justify-between text-lg font-bold"><span style={{ color: "#C9A84C" }}>الإجمالي</span><span style={{ color: "#C9A84C" }}>{grandTotal.toLocaleString("en-US")} <SarSymbol size={18} /></span></div>
                      </div>
                      <MarsaButton variant="gold" size="lg" onClick={() => setStep(3)} className="w-full mt-4 py-4 text-lg" style={{ color: "#1C1B2E" }}>
                        متابعة للدفع
                      </MarsaButton>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== الخطوة 3: التأكيد والدفع ===== */}
        {step === 3 && (
          <div className="max-w-2xl mx-auto pt-4">
            <MarsaButton variant="ghost" size="sm" icon={<ArrowRight size={16} />} onClick={() => setStep(2)} className="mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
              رجوع
            </MarsaButton>

            <h2 className="text-2xl font-bold text-center mb-6" style={{ color: "white" }}>تأكيد ودفع</h2>

            {/* ملخص */}
            <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex items-center gap-3 mb-4 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold" style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#C9A84C" }}>{selectedClient?.name.charAt(0)}</div>
                <div><p className="font-bold" style={{ color: "white" }}>{selectedClient?.name}</p>{selectedClient?.companyName && <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{selectedClient.companyName}</p>}</div>
              </div>
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between py-2 text-sm">
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>{item.name} × {item.quantity}</span>
                  <span className="font-bold" style={{ color: "white" }}>{(item.price * item.quantity).toLocaleString("en-US")} <SarSymbol size={14} /></span>
                </div>
              ))}
              <div className="mt-4 pt-4 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex justify-between text-sm"><span style={{ color: "rgba(255,255,255,0.5)" }}>المجموع</span><span style={{ color: "white" }}>{subtotal.toLocaleString("en-US")} <SarSymbol size={14} /></span></div>
                <div className="flex justify-between text-sm"><span style={{ color: "rgba(255,255,255,0.5)" }}>ضريبة 15%</span><span style={{ color: "white" }}>{taxAmount.toLocaleString("en-US")} <SarSymbol size={14} /></span></div>
                <div className="flex justify-between text-xl font-bold pt-2"><span style={{ color: "#C9A84C" }}>الإجمالي</span><span style={{ color: "#C9A84C" }}>{grandTotal.toLocaleString("en-US")} <SarSymbol size={20} /></span></div>
              </div>
            </div>

            {/* طرق الدفع */}
            <h3 className="text-lg font-bold mb-4" style={{ color: "white" }}>طريقة الدفع</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {paymentMethods.map((pm) => (
                <button key={pm.id} onClick={() => setSelectedPayment(pm.id)}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl transition-all hover:scale-105"
                  style={{
                    backgroundColor: selectedPayment === pm.id ? pm.bg : "rgba(255,255,255,0.04)",
                    border: selectedPayment === pm.id ? `2px solid ${pm.color}` : "1px solid rgba(255,255,255,0.1)",
                  }}>
                  <pm.icon size={32} style={{ color: selectedPayment === pm.id ? pm.color : "rgba(255,255,255,0.3)" }} />
                  <span className="text-sm font-bold" style={{ color: selectedPayment === pm.id ? pm.color : "rgba(255,255,255,0.5)" }}>{pm.label}</span>
                </button>
              ))}
            </div>

            {/* حقول إضافية */}
            {selectedPayment === "CASH" && (
              <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.2)" }}>
                <label className="block text-sm font-medium mb-2" style={{ color: "#059669" }}>المبلغ المستلم</label>
                <input type="number" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)}
                  className="w-full px-4 py-4 rounded-xl text-2xl font-bold text-center outline-none"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(5,150,105,0.3)" }}
                  placeholder="0.00" />
                {amountReceived && parseFloat(amountReceived) >= grandTotal && (
                  <div className="mt-3 text-center">
                    <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>الباقي: </span>
                    <span className="text-2xl font-bold" style={{ color: "#C9A84C" }}>{change.toLocaleString("en-US")} <SarSymbol size={20} /></span>
                  </div>
                )}
              </div>
            )}

            {selectedPayment === "BANK_TRANSFER" && (
              <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
                <label className="block text-sm font-medium mb-2" style={{ color: "#7C3AED" }}>رقم المرجع (اختياري)</label>
                <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(124,58,237,0.3)" }} />
              </div>
            )}

            {/* زر التأكيد */}
            <MarsaButton variant="gold" size="lg" onClick={confirmTransaction}
              disabled={!selectedPayment || processing || (selectedPayment === "CASH" && (!amountReceived || parseFloat(amountReceived) < grandTotal))}
              loading={processing}
              className="w-full py-5 rounded-2xl text-xl"
              style={{ color: "#1C1B2E" }}>
              {processing ? "جارٍ المعالجة..." : "تأكيد العملية"}
            </MarsaButton>
          </div>
        )}

        {/* ===== الخطوة 4: النجاح ===== */}
        {step === 4 && txnResult && (
          <div className="max-w-md mx-auto pt-16 text-center">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: "rgba(5,150,105,0.15)" }}>
              <CheckCircle size={56} style={{ color: "#059669" }} />
            </div>
            <h2 className="text-3xl font-bold mb-2" style={{ color: "white" }}>تمت العملية بنجاح!</h2>
            <p className="text-lg mb-1" style={{ color: "#C9A84C" }}>رقم العملية: {txnResult.transactionNumber}</p>
            <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>رقم الفاتورة: {txnResult.invoiceNumber}</p>

            <div className="rounded-2xl p-6 mb-8" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <p className="text-3xl font-bold" style={{ color: "#C9A84C" }}>{txnResult.grandTotal.toLocaleString("en-US")} <SarSymbol size={18} /></p>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>{paymentLabels[txnResult.paymentMethod]}</p>
              {txnResult.changeAmount != null && txnResult.changeAmount > 0 && (
                <p className="text-lg mt-2" style={{ color: "#059669" }}>الباقي: {txnResult.changeAmount.toLocaleString("en-US")} <SarSymbol size={18} /></p>
              )}
            </div>

            <div className="flex gap-4">
              <MarsaButton variant="ghost" size="lg" icon={<Printer size={22} />} onClick={printReceipt}
                className="flex-1 py-4 text-lg"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(255,255,255,0.15)" }}>
                طباعة إيصال
              </MarsaButton>
              <MarsaButton variant="gold" size="lg" icon={<RotateCcw size={22} />} onClick={reset}
                className="flex-1 py-4 text-lg"
                style={{ color: "#1C1B2E" }}>
                عملية جديدة
              </MarsaButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
