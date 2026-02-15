"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import { Header } from "@/components/layout/header";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { createTranslator } from "@/lib/i18n/translations";

export default function LoginPage() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const router = useRouter();
  
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isRtl = lang === "ar";

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError(t("login.error.invalidEmail"));
      return;
    }

    setEmail(normalizedEmail);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(t("login.error.generic"));
      }

      setStep("otp");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (otp.length < 6) {
      setError(t("login.error.invalidOtp"));
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);

    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, code: otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(t("login.error.invalidCode"));
      }

      // Success
      router.push(data.redirectTo || "/dashboard");
      router.refresh(); 

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen pt-32 pb-20 bg-gray-50 flex flex-col justify-center">
        <Container>
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-8">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("login.title")}</h1>
                <p className="text-gray-500 text-sm">
                  {step === "email" ? t("login.subtitle") : `${t("login.otpSent")} ${email}`}
                </p>
              </div>

              {error && (
                <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg text-center">
                  {error}
                </div>
              )}

              {step === "email" ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("login.emailPlaceholder")}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-isaudi-green/20 focus:border-isaudi-green outline-none transition-all text-gray-900 dir-ltr text-left"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-isaudi-green hover:bg-isaudi-green-dark text-white py-6 text-lg"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin" /> : t("login.sendCode")}
                  </Button>
                  <p className="text-xs text-center text-gray-400 mt-4">
                    {t("login.footerNote")}
                  </p>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder={t("login.otpPlaceholder")}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-isaudi-green/20 focus:border-isaudi-green outline-none transition-all text-center text-2xl tracking-widest font-mono text-gray-900"
                      maxLength={6}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-isaudi-green hover:bg-isaudi-green-dark text-white py-6 text-lg"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin" /> : t("login.verify")}
                  </Button>
                  
                  <div className="flex items-center justify-between mt-6">
                    <button 
                      type="button"
                      onClick={() => setStep("email")}
                      className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1"
                    >
                      {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                      {t("login.back")}
                    </button>
                    <button 
                      type="button"
                      onClick={handleRequestOtp}
                      className="text-sm text-isaudi-green hover:underline"
                    >
                      {t("login.resend")}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </Container>
      </div>
    </>
  );
}
