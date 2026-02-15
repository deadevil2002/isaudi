"use client";

import { useState } from "react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import { BackToDashboardLink } from "@/components/common/back-to-dashboard";

interface SettingsClientProps {
  userEmail: string;
  emailVerified: boolean;
  plan: string;
  planExpiresAt: number | null;
}

function formatDate(timestamp: number | null, lang: "ar" | "en"): string | null {
  if (!timestamp) return null;
  try {
    return new Date(timestamp).toLocaleDateString(
      lang === "en" ? "en-US" : "ar-SA"
    );
  } catch {
    return null;
  }
}

export function SettingsClient({ userEmail, emailVerified, plan, planExpiresAt }: SettingsClientProps) {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [verified, setVerified] = useState(emailVerified);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleResendVerification = async () => {
    setSending(true);
    setStatusMessage(null);
    setStatusError(null);
    try {
      const res = await fetch("/api/auth/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(t("settings.verification.error.sendFailed"));
      }
      if (data.alreadyVerified) {
        setVerified(true);
        setVerified(true);
        setStatusMessage(t("settings.verification.alreadyVerified"));
      } else {
        setStatusMessage(t("settings.verification.sent"));
      }
    } catch (err: any) {
      setStatusError(err.message || t("settings.verification.error.unexpected"));
    } finally {
      setSending(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      setLoggingOut(false);
    }
  };

  const planName =
    plan === "free"
      ? t("billing.freeBadge")
      : plan === "starter"
      ? t("billing.plan.basic")
      : plan === "growth" || plan === "pro"
      ? t("billing.plan.pro")
      : plan === "business"
      ? t("billing.plan.business")
      : plan;
  const planExpiry = formatDate(planExpiresAt, lang);

  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-20">
      <Container>
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {t("settings.title")}
              </h1>
              <p className="text-gray-600 text-sm">
                {t("settings.subtitle")}
              </p>
            </div>
            <div className="hidden md:inline-flex">
              <BackToDashboardLink />
            </div>
          </div>

          <div className="md:hidden">
            <Button
              asChild
              variant="outline"
              className="w-full"
            >
              <a href="/dashboard">
                {t("settings.backToDashboard")}
              </a>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">
                {t("settings.account.title")}
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">
                    {t("settings.account.email")}
                  </span>
                  <span className="font-medium text-gray-900">{userEmail}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">
                    {t("settings.account.verificationStatus")}
                  </span>
                  <span className={`font-semibold ${verified ? "text-emerald-600" : "text-orange-600"}`}>
                    {verified
                      ? t("settings.account.verified")
                      : t("settings.account.notVerified")}
                  </span>
                </div>
              </div>

              {!verified && (
                <div className="mt-4 space-y-2">
                  <Button
                    onClick={handleResendVerification}
                    disabled={sending}
                    className="w-full md:w-auto"
                    variant="secondary"
                  >
                    {sending
                      ? t("settings.verification.sending")
                      : t("settings.verification.resend")}
                  </Button>
                  {statusMessage && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md p-2 mt-1">
                      {statusMessage}
                    </div>
                  )}
                  {statusError && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-md p-2 mt-1">
                      {statusError}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">
                {t("settings.plan.title")}
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">
                    {t("settings.plan.current")}
                  </span>
                  <span className="font-semibold text-gray-900">{planName}</span>
                </div>
                {planExpiry && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">
                      {t("settings.plan.expiry")}
                    </span>
                    <span className="font-medium text-gray-900">{planExpiry}</span>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <Button
                  asChild
                  variant="outline"
                  className="w-full md:w-auto"
                >
                  <a href="/billing">
                    {t("settings.plan.manage")}
                  </a>
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-1">
                {t("settings.logout.title")}
              </h2>
              <p className="text-sm text-gray-600">
                {t("settings.logout.body")}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={loggingOut}
              className="whitespace-nowrap"
              >
                {loggingOut
                  ? t("settings.logout.loggingOut")
                  : t("settings.logout.cta")}
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}
