"use client";

import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import { useState } from "react";
import { BadgeCheck, CalendarDays, CreditCard, LogOut, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import { SubscriptionEntitlements } from "@/lib/subscription/types";

interface SettingsClientProps {
  userEmail: string; emailVerified: boolean; plan: string; planExpiresAt: number | null;
  subscription?: SubscriptionEntitlements | null;
  previewState?: "default" | "unverified" | "sending" | "success" | "error" | "inactive";
}

function formatDate(timestamp: number | null, lang: "ar" | "en"): string | null {
  if (!timestamp) return null;
  try { return new Date(String(timestamp).length === 10 ? timestamp * 1000 : timestamp).toLocaleDateString(lang === "en" ? "en-US" : "ar-SA", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return null; }
}

const card = "relative overflow-hidden rounded-2xl border border-white/10 bg-[#0e1218] p-5 shadow-[0_18px_45px_rgba(0,0,0,.18)] sm:p-6";

export function SettingsClient({ userEmail, emailVerified, plan, subscription, previewState }: SettingsClientProps) {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const reduceMotion = useReducedMotionConfig();
  const preview = Boolean(previewState);
  const [sending, setSending] = useState(previewState === "sending");
  const [statusMessage, setStatusMessage] = useState<string | null>(previewState === "success" ? t("settings.verification.sent") : null);
  const [statusError, setStatusError] = useState<string | null>(previewState === "error" ? t("settings.verification.error.sendFailed") : null);
  const [verified, setVerified] = useState(!["unverified", "sending", "success", "error"].includes(previewState || "") && emailVerified);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleResendVerification = async () => {
    if (preview) return;
    setSending(true); setStatusMessage(null); setStatusError(null);
    try {
      const res = await fetch("/api/auth/send-verification", { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(t("settings.verification.error.sendFailed"));
      if (data.alreadyVerified) { setVerified(true); setStatusMessage(t("settings.verification.alreadyVerified")); }
      else setStatusMessage(t("settings.verification.sent"));
    } catch (error: unknown) { setStatusError(error instanceof Error ? error.message : t("settings.verification.error.unexpected")); }
    finally { setSending(false); }
  };

  const handleLogout = async () => {
    if (preview) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // A full navigation guarantees the authenticated document is discarded.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
    catch { setLoggingOut(false); }
  };

  const normalizedPlan = plan === "basic" ? "starter" : plan === "pro" ? "growth" : plan;
  const planName = normalizedPlan === "free" ? t("billing.freeBadge") : normalizedPlan === "starter" ? t("billing.plan.basic") : normalizedPlan === "growth" ? t("billing.plan.pro") : normalizedPlan === "business" ? t("billing.plan.business") : normalizedPlan;
  const active = previewState === "inactive" ? false : Boolean(subscription?.isActiveNow);
  const start = formatDate(subscription?.startedAt ?? null, lang);
  const end = formatDate(subscription?.expiresAt ?? null, lang);
  const status = previewState === "inactive" ? "inactive" : (subscription?.status || "none");
  const enter = reduceMotion ? {} : { y: [6, 0], opacity: [.85, 1] };

  return (
    <div className="mx-auto max-w-5xl space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      <header className="flex flex-col gap-2 pb-2"><span className="text-xs font-bold uppercase tracking-[.22em] text-[#e6b95c]">iSaudi.ai</span><h1 className="text-3xl font-bold text-white sm:text-4xl">{t("settings.title")}</h1><p className="max-w-2xl text-sm leading-7 text-[#94a3b8]">{t("settings.subtitle")}</p></header>
      <div className="grid gap-6 lg:grid-cols-[1.08fr_.92fr]">
        <motion.section animate={enter} transition={{ duration: .3 }} className={`${card} lg:self-start`}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e6b95c]/60 to-transparent" />
          <div className="mb-6 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl border border-[#e6b95c]/20 bg-[#e6b95c]/10 text-[#e6b95c]"><UserRound className="h-5 w-5" aria-hidden="true" /></span><div><h2 className="font-bold text-white">{t("settings.account.title")}</h2><p className="text-xs leading-5 text-[#64748b]">{t("settings.account.description")}</p></div></div>
          <div className="rounded-xl border border-white/10 bg-[#161c24] p-4"><p className="break-all text-sm font-semibold text-white" dir="ltr">{userEmail}</p><div className="mt-3 flex items-center gap-2">{verified ? <BadgeCheck className="h-4 w-4 text-[#0fc9a7]" /> : <ShieldCheck className="h-4 w-4 text-[#e6b95c]" />}<span className={verified ? "text-sm text-[#0fc9a7]" : "text-sm text-[#e6b95c]"}>{verified ? t("settings.account.verified") : t("settings.account.notVerified")}</span></div></div>
          {!verified && <div className="mt-5"><Button onClick={handleResendVerification} disabled={sending} className="min-h-11 w-full rounded-xl bg-[#e6b95c] font-bold text-[#06090c] hover:bg-[#f0c96e] sm:w-auto"><RefreshCw className={`h-4 w-4 ${sending ? "animate-spin" : ""}`} />{sending ? t("settings.verification.sending") : t("settings.verification.resend")}</Button><AnimatePresence mode="wait">{(statusMessage || statusError) && <motion.div initial={reduceMotion ? false : { y: 6, opacity: .7 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} role="status" className={`mt-4 rounded-xl border p-3 text-sm ${statusError ? "border-red-400/20 bg-red-400/10 text-red-300" : "border-[#0fc9a7]/20 bg-[#0fc9a7]/10 text-[#72ead4]"}`}>{statusError || statusMessage}</motion.div>}</AnimatePresence></div>}
        </motion.section>
        <motion.section animate={enter} transition={{ duration: .3, delay: reduceMotion ? 0 : .05 }} className={card}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0fc9a7]/60 to-transparent" />
          <div className="mb-6 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl border border-[#0fc9a7]/20 bg-[#0fc9a7]/10 text-[#0fc9a7]"><CreditCard className="h-5 w-5" /></span><div><h2 className="font-bold text-white">{t("settings.plan.title")}</h2><p className="text-xs text-[#64748b]">{t("settings.plan.current")}</p></div></div><span className="rounded-full border border-[#0fc9a7]/20 bg-[#0fc9a7]/10 px-3 py-1 text-xs font-bold text-[#0fc9a7]">{planName}</span></div>
          <dl className="space-y-3 text-sm"><div className="flex items-center justify-between gap-4 rounded-xl bg-[#161c24] p-3"><dt className="text-[#94a3b8]">{lang === "ar" ? "الحالة" : "Status"}</dt><dd className={active ? "font-semibold text-[#0fc9a7]" : "font-semibold text-[#94a3b8]"}>{status}</dd></div>{start && <div className="flex items-center justify-between gap-4 px-3"><dt className="flex items-center gap-2 text-[#94a3b8]"><CalendarDays className="h-4 w-4" />{lang === "ar" ? "تاريخ البدء" : "Start date"}</dt><dd className="text-white">{start}</dd></div>}{end && <div className="flex items-center justify-between gap-4 px-3"><dt className="flex items-center gap-2 text-[#94a3b8]"><CalendarDays className="h-4 w-4" />{t("settings.plan.expiry")}</dt><dd className="text-white">{end}</dd></div>}{!active && <p className="rounded-xl border border-white/10 bg-[#161c24] p-3 text-[#94a3b8]">{lang === "ar" ? "لا يوجد اشتراك نشط" : "No active subscription"}</p>}</dl>
          <Button asChild variant="outline" className="mt-6 min-h-11 w-full rounded-xl border-white/10 bg-[#161c24] text-white hover:bg-[#1d252f] hover:text-white"><a href={preview ? "#" : "/billing"}>{t("settings.plan.manage")}</a></Button>
        </motion.section>
      </div>
      <section className={`${card} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}><div><h2 className="font-bold text-white">{t("settings.logout.title")}</h2><p className="mt-1 text-sm text-[#94a3b8]">{t("settings.logout.body")}</p></div><Button variant="outline" onClick={handleLogout} disabled={loggingOut} className="min-h-11 rounded-xl border-red-400/20 bg-red-400/5 text-red-300 hover:bg-red-400/10 hover:text-red-200"><LogOut className="h-4 w-4" />{loggingOut ? t("settings.logout.loggingOut") : t("settings.logout.cta")}</Button></section>
    </div>
  );
}
