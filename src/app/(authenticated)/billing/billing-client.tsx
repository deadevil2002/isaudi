"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, CalendarDays, Check, Crown, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import { calculateMinimumAnnualSavingsPercent } from "@/lib/pricing/annual-savings";
import { SubscriptionEntitlements } from "@/lib/subscription/types";
import { User } from "@/lib/db/client";
import { cn } from "@/lib/utils";
import { billingPlanRank, normalizeBillingPlanId } from "@/lib/billing/ui-plans";
type BillingPreviewState = "default" | "starter" | "growth" | "business" | "yearly" | "checkout" | "verify_error";

const basePlans = [
  { id: "starter" as const, priceMonthly: 199, priceYearly: 1999, popular: false, providerId: "starter" as const },
  { id: "growth" as const, priceMonthly: 399, priceYearly: 3999, popular: true, providerId: "growth" as const },
  { id: "business" as const, priceMonthly: 899, priceYearly: 8999, popular: false, providerId: "enterprise" as const },
];

export function BillingClient({ user, subscription, previewState }: { user: User; subscription: SubscriptionEntitlements | null; previewState?: BillingPreviewState }) {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const reduceMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const router = useRouter();
  const preview = Boolean(previewState);
  const previewPlan = previewState === "starter" || previewState === "growth" || previewState === "business" ? previewState : null;
  const currentPlan = previewPlan || normalizeBillingPlanId(subscription?.planId || user.plan);
  const [isYearly, setIsYearly] = useState(previewState === "yearly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(previewState === "checkout" ? "growth" : null);
  const [verifyErrorKey, setVerifyErrorKey] = useState<string | null>(previewState === "verify_error" ? "billing.verify.failedCharged" : null);
  const status = previewState === "verify_error" ? "processed" : searchParams.get("status");
  const tapId = searchParams.get("tap_id") || searchParams.get("tapId");
  const annualSavings = calculateMinimumAnnualSavingsPercent(basePlans);

  const plans = useMemo(() => basePlans.map((plan) => {
    const legacyName = plan.id === "starter" ? "basic" : plan.id === "growth" ? "pro" : "business";
    const featureCount = plan.id === "business" ? 4 : 5;
    return { ...plan, name: t(`billing.plan.${legacyName}`), description: t(`billing.plan.${legacyName}.description`), features: Array.from({ length: featureCount }, (_, i) => t(`billing.plan.${legacyName}.f${i + 1}`)) };
  }), [t]);

  useEffect(() => {
    if (preview || status !== "processed") return;
    (async () => {
      try {
        const stored = window.sessionStorage.getItem("tapChargeId");
        const finalTapId = tapId || stored || "";
        if (!finalTapId) { setVerifyErrorKey("billing.verify.missingTransaction"); return; }
        const res = await fetch("/api/billing/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tapId: finalTapId }) });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) { window.sessionStorage.removeItem("tapChargeId"); router.replace("/billing?updated=1"); router.refresh(); return; }
        setVerifyErrorKey("billing.verify.failedCharged"); router.refresh();
      } catch { setVerifyErrorKey("billing.verify.failedRetry"); router.refresh(); }
    })();
  }, [preview, status, tapId, router]);

  const handleSubscribe = async (plan: typeof basePlans[number]) => {
    if (preview) return;
    setLoadingPlan(plan.id);
    try {
      const res = await fetch("/api/billing/tap/create-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: plan.providerId, interval: isYearly ? "year" : "month" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("billing.error.generic"));
      if (typeof data.tapChargeId === "string") window.sessionStorage.setItem("tapChargeId", data.tapChargeId);
      const redirectUrl = data.redirectUrl || data.url;
      if (redirectUrl) window.location.assign(redirectUrl);
    } catch (error) { console.error("Subscription error:", error); alert(t("billing.error.generic")); }
    finally { setLoadingPlan(null); }
  };

  const currentName = currentPlan === "free" ? t("billing.freeBadge") : plans.find((p) => p.id === currentPlan)?.name || currentPlan;
  const expiresAt = subscription?.expiresAt || user.planExpiresAt;
  const interval = (subscription as (SubscriptionEntitlements & { interval?: "month" | "year" }) | null)?.interval;
  const date = expiresAt ? new Date(String(expiresAt).length === 10 ? expiresAt * 1000 : expiresAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { year: "numeric", month: "long", day: "numeric" }) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8" dir={lang === "ar" ? "rtl" : "ltr"}>
      <header className="space-y-2"><span className="text-xs font-bold uppercase tracking-[.22em] text-[#e6b95c]">iSaudi.ai</span><h1 className="text-3xl font-bold text-white sm:text-4xl">{t("billing.title")}</h1><p className="text-sm leading-7 text-[#94a3b8]">{lang === "ar" ? "تحكم في باقتك ودورة الفوترة من مكان واحد واضح وآمن." : "Manage your plan and billing cycle from one clear, secure workspace."}</p></header>

      <section className="relative overflow-hidden rounded-3xl border border-[#0fc9a7]/20 bg-[#0e1218] p-5 shadow-[0_25px_60px_rgba(0,0,0,.25)] sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0fc9a7] to-transparent" />
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center"><div className="flex items-center gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[#0fc9a7]/20 bg-[#0fc9a7]/10 text-[#0fc9a7]"><ShieldCheck className="h-7 w-7" /></span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#64748b]">{t("billing.currentPlan")}</p><div className="mt-1 flex flex-wrap items-center gap-2"><h2 className="text-2xl font-bold text-white">{currentName}</h2><span className="rounded-full border border-[#0fc9a7]/20 bg-[#0fc9a7]/10 px-2.5 py-1 text-xs font-bold text-[#0fc9a7]">{subscription?.status || (currentPlan === "free" ? "free" : "active")}</span></div></div></div><dl className="grid grid-cols-2 gap-3 text-sm md:min-w-72"><div className="rounded-xl bg-[#161c24] p-3"><dt className="text-xs text-[#64748b]">{lang === "ar" ? "دورة الفوترة" : "Billing period"}</dt><dd className="mt-1 font-semibold text-white">{interval === "year" ? t("billing.toggle.yearly") : interval === "month" ? t("billing.toggle.monthly") : "—"}</dd></div><div className="rounded-xl bg-[#161c24] p-3"><dt className="flex items-center gap-1 text-xs text-[#64748b]"><CalendarDays className="h-3.5 w-3.5" />{t("billing.expiresAt")}</dt><dd className="mt-1 font-semibold text-white">{date || "—"}</dd></div></dl></div>
        <AnimatePresence>{status === "processed" && <motion.div initial={reduceMotion ? false : { y: 5, opacity: .8 }} animate={{ y: 0, opacity: 1 }} className={`mt-5 flex items-start gap-3 rounded-xl border p-4 text-sm ${verifyErrorKey ? "border-red-400/20 bg-red-400/10 text-red-300" : "border-[#0fc9a7]/20 bg-[#0fc9a7]/10 text-[#72ead4]"}`}>{verifyErrorKey ? <AlertCircle className="h-5 w-5 shrink-0" /> : <Check className="h-5 w-5 shrink-0" />}<span>{t(verifyErrorKey || "billing.status.processed")}</span></motion.div>}</AnimatePresence>
      </section>

      <section>
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-bold text-white">{t("billing.choosePlan")}</h2><p className="mt-2 text-sm text-[#94a3b8]">{lang === "ar" ? "اختر الدورة المناسبة، ثم انتقل إلى الدفع الآمن عبر Tap." : "Choose your billing cycle, then continue to secure Tap checkout."}</p></div><div className="inline-flex self-start rounded-xl border border-white/10 bg-[#0e1218] p-1" role="group" aria-label={t("billing.toggle.aria")}><button type="button" onClick={() => setIsYearly(false)} className={cn("min-h-10 rounded-lg px-4 text-sm font-bold transition-all duration-200", !isYearly ? "bg-[#e6b95c] text-[#06090c]" : "text-[#94a3b8] hover:text-white")}>{t("billing.toggle.monthly")}</button><button type="button" onClick={() => setIsYearly(true)} className={cn("min-h-10 rounded-lg px-4 text-sm font-bold transition-all duration-200", isYearly ? "bg-[#e6b95c] text-[#06090c]" : "text-[#94a3b8] hover:text-white")}>{t("billing.toggle.yearly")} <span className="text-[10px]">-{annualSavings}%</span></button></div></div>
        <div className="grid gap-5 lg:grid-cols-3">{plans.map((plan) => {
          const isCurrent = currentPlan === plan.id && (subscription?.isActiveNow !== false || preview);
          const isDowngrade = billingPlanRank[plan.id] < billingPlanRank[currentPlan];
          return <motion.article layout key={plan.id} transition={{ duration: reduceMotion ? 0 : .35 }} className={cn("relative flex flex-col overflow-hidden rounded-2xl border bg-[#0e1218] p-5 transition-[border-color,transform,box-shadow] duration-250 sm:p-6", isCurrent ? "border-[#0fc9a7]/50 shadow-[0_18px_50px_rgba(15,201,167,.08)]" : plan.popular ? "border-[#e6b95c]/35" : "border-white/10 hover:-translate-y-1 hover:border-white/20")}>
            {isCurrent && <div className="absolute inset-x-0 top-0 h-1 bg-[#0fc9a7]" />}{plan.popular && !isCurrent && <span className="absolute end-4 top-4 rounded-full border border-[#e6b95c]/20 bg-[#e6b95c]/10 px-2.5 py-1 text-[10px] font-bold text-[#e6b95c]">{t("billing.badge.popular")}</span>}
            <div className="mb-6 flex items-start gap-3"><span className={cn("grid h-10 w-10 place-items-center rounded-xl", isCurrent ? "bg-[#0fc9a7]/10 text-[#0fc9a7]" : "bg-[#161c24] text-[#e6b95c]")}>{plan.id === "business" ? <Crown className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}</span><div><h3 className="text-lg font-bold text-white">{plan.name}</h3><p className="mt-1 text-xs text-[#94a3b8]">{plan.description}</p></div></div>
            <div className="mb-6 flex items-end gap-2"><AnimatePresence mode="popLayout" initial={false}><motion.span key={isYearly ? "year" : "month"} initial={reduceMotion ? false : { y: 6, opacity: .75 }} animate={{ y: 0, opacity: 1 }} exit={reduceMotion ? undefined : { y: -6, opacity: 0 }} transition={{ duration: .32 }} className="text-4xl font-bold tracking-tight text-white">{isYearly ? plan.priceYearly.toLocaleString(lang === "ar" ? "ar-SA" : "en-US") : plan.priceMonthly.toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}</motion.span></AnimatePresence><span className="pb-1 text-xs text-[#64748b]">{t("billing.currency")} / {isYearly ? t("billing.per.year") : t("billing.per.month")}</span></div>
            <ul className="mb-7 flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2.5 text-sm leading-6 text-[#b7c0cd]"><Check className="mt-1 h-4 w-4 shrink-0 text-[#0fc9a7]" /><span>{feature}</span></li>)}</ul>
            <Button onClick={() => handleSubscribe(plan)} disabled={isCurrent || isDowngrade || Boolean(loadingPlan)} className={cn("min-h-12 w-full rounded-xl font-bold", isCurrent ? "bg-[#0fc9a7]/10 text-[#0fc9a7]" : isDowngrade ? "bg-[#161c24] text-[#64748b]" : "bg-[#e6b95c] text-[#06090c] hover:bg-[#f0c96e]")}>{loadingPlan === plan.id ? <Loader2 className="h-5 w-5 animate-spin" /> : isCurrent ? t("billing.button.current") : isDowngrade ? t("billing.button.downgrade") : isYearly ? t("billing.button.subscribeYearly") : t("billing.button.subscribeMonthly")}</Button>
          </motion.article>;
        })}</div>
      </section>
    </div>
  );
}
