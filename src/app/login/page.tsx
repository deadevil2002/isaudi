"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import { Header } from "@/components/layout/header";
import { Loader2, X } from "lucide-react";
import { createTranslator } from "@/lib/i18n/translations";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const router = useRouter();
  
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

      await res.json();

      if (!res.ok) {
        throw new Error(t("login.error.generic"));
      }

      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
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

      router.push(data.redirectTo || "/dashboard");
      router.refresh();

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#06090c] text-[#f0f4f8] selection:bg-[#0fc9a7]/20 selection:text-[#0fc9a7]">
      <Header />
      <div className="min-h-screen pt-32 pb-20 flex flex-col justify-center relative z-10">
        {/* Background Gradient similar to preview modal wrapper */}
        <div className="absolute inset-0 bg-[rgba(2,5,8,0.78)] backdrop-blur-[14px] -z-10" />

        <Container>
          <div className="w-full max-w-[30rem] mx-auto p-8 rounded-[1.5rem] bg-[#0e1218] border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.5)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-[150px] pointer-events-none" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(15, 201, 167, 0.1), transparent 38%)' }} />

            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <div className="relative w-[5.75rem] h-10 mb-2">
                  <Image src="/brand/design-preview-logo.png" alt="isaudi.ai" fill className="object-contain" />
                </div>
                <span className="text-[#e6b95c] text-[0.78rem] font-bold tracking-[0.04em]">
                  {t("login.secureEyebrow")}
                </span>
                <h2 className="text-2xl font-bold mt-2 text-white">{t("login.title")}</h2>
              </div>
              <Link href="/">
                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full border border-white/10 bg-[#161c24] text-white hover:bg-white/10">
                  <X size={20} />
                </Button>
              </Link>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] text-sm rounded-lg text-center relative z-10">
                {error}
              </div>
            )}

            <div className="relative z-10">
              {step === "email" ? (
                <form onSubmit={handleRequestOtp} className="space-y-6">
                  <div>
                    <label htmlFor="login-email" className="block text-sm text-[#94a3b8] mb-2">
                      {t("login.emailPlaceholder")}
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full px-4 py-3 rounded-lg bg-[#161c24] border border-white/10 focus:ring-1 focus:ring-[#e6b95c] focus:border-[#e6b95c] outline-none transition-all text-white dir-ltr text-left"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-[#c5993c] to-[#e6b95c] text-black font-semibold rounded-full py-6 text-lg hover:opacity-90 border-none transition-opacity"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin" /> : t("login.sendCode")}
                  </Button>
                  <p className="text-xs text-center text-[#64748b]">
                    {t("login.footerNote")}
                  </p>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <p className="text-sm text-[#94a3b8] leading-relaxed mb-6">
                    {t("login.otpSent")} {email}
                  </p>
                  <div>
                    <label htmlFor="login-otp" className="block text-sm text-[#94a3b8] mb-2">
                      {t("login.otpPlaceholder")}
                    </label>
                    <input
                      id="login-otp"
                      type="text"
                      inputMode="numeric"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="••••••"
                      className="w-full px-4 py-3 rounded-lg bg-[#161c24] border border-white/10 focus:ring-1 focus:ring-[#e6b95c] focus:border-[#e6b95c] outline-none transition-all text-center text-2xl tracking-[0.55em] font-mono text-white dir-ltr"
                      maxLength={6}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-4">
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-[#c5993c] to-[#e6b95c] text-black font-semibold rounded-full py-6 text-lg hover:opacity-90 border-none transition-opacity"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="animate-spin" /> : t("login.verify")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep("email")}
                      className="w-full bg-[#1d252f] text-white hover:bg-[#161c24] border border-white/10 rounded-full py-6 font-medium transition-colors"
                      disabled={loading}
                    >
                      {t("login.back")}
                    </Button>
                  </div>
                  <div className="text-center mt-6">
                    <button 
                      type="button"
                      onClick={handleRequestOtp}
                      className="text-sm text-[#0fc9a7] hover:underline"
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
    </main>
  );
}
