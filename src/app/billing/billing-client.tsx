"use client";

import { useState, useEffect } from "react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { SubscriptionEntitlements } from "@/lib/subscription/types";
import { User } from "@/lib/db/client";
import { Check, Loader2, CreditCard, ShieldCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchParams, useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

const basePlans = [
  {
    id: "basic",
    priceMonthly: 199,
    priceYearly: 1999,
    popular: false,
  },
  {
    id: "pro",
    priceMonthly: 399,
    priceYearly: 3999,
    popular: true,
  },
  {
    id: "business",
    priceMonthly: 899,
    priceYearly: 8999,
    popular: false,
  },
] as const;

const tapPlanIdByUiPlanId = {
  basic: "starter",
  pro: "growth",
  business: "enterprise",
} as const;

export function BillingClient({ user, subscription }: { user: User, subscription: SubscriptionEntitlements | null }) {
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  const plans = basePlans.map((plan) => {
    const nameKey = `billing.plan.${plan.id}` as const;
    const descKey = `billing.plan.${plan.id}.description` as const;
    const featureKeys =
      plan.id === "basic"
        ? [
            "billing.plan.basic.f1",
            "billing.plan.basic.f2",
            "billing.plan.basic.f3",
            "billing.plan.basic.f4",
            "billing.plan.basic.f5",
          ]
        : plan.id === "pro"
        ? [
            "billing.plan.pro.f1",
            "billing.plan.pro.f2",
            "billing.plan.pro.f3",
            "billing.plan.pro.f4",
            "billing.plan.pro.f5",
          ]
        : [
            "billing.plan.business.f1",
            "billing.plan.business.f2",
            "billing.plan.business.f3",
            "billing.plan.business.f4",
          ];

    return {
      ...plan,
      name: t(nameKey),
      description: t(descKey),
      features: featureKeys.map((k) => t(k)),
    };
  });

  const [isYearly, setIsYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const planOrder = Array.from(new Set(['free', ...plans.map(p => p.id)]));
  
  const status = searchParams.get('status');
  const tapId = searchParams.get('tap_id') || searchParams.get('tapId');

  useEffect(() => {
    if (status === 'processed') {
      (async () => {
        try {
          const storedTapChargeId =
            typeof window !== "undefined" ? window.sessionStorage.getItem("tapChargeId") : null;
          const finalTapId = tapId || storedTapChargeId || "";

          if (!finalTapId) {
            setVerifyError("Missing Tap transaction ID. Please contact support if you were charged.");
            return;
          }

          const res = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tapId: finalTapId }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data?.ok) {
            try {
              window.sessionStorage.removeItem("tapChargeId");
            } catch {}
            window.location.href = "/billing?updated=1";
            return;
          }
          setVerifyError("Payment verification failed. If you were charged, please contact support.");
          router.refresh();
        } catch {
          setVerifyError("Payment verification failed. Please refresh and try again.");
          router.refresh();
        }
      })();
      return;
    }

    if (status === 'success') {
      router.refresh();
    }
  }, [status, tapId, router]);

  const handleSubscribe = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const interval = isYearly ? 'year' : 'month';
      const apiPlanId = (tapPlanIdByUiPlanId as Record<string, string | undefined>)[planId];
      if (!apiPlanId) {
        throw new Error(t("billing.error.generic"));
      }

      const res = await fetch('/api/billing/tap/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: apiPlanId, interval })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || t("billing.error.generic"));
      }
      
      const redirectUrl = data.redirectUrl || data.url;
      const createdTapChargeId = typeof data?.tapChargeId === "string" ? data.tapChargeId : null;
      if (createdTapChargeId) {
        try {
          window.sessionStorage.setItem("tapChargeId", createdTapChargeId);
        } catch {}
      }
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    } catch (error) {
      console.error('Subscription error:', error);
      alert(t("billing.error.generic"));
    } finally {
      setLoadingPlan(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(lang === "en" ? "en-US" : "ar-SA");
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-20">
      <Container>
        <div className="max-w-5xl mx-auto space-y-12">
          
          {/* Current Plan Status */}
          <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
            <h1 className="text-2xl font-bold mb-6">{t("billing.title")}</h1>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-isaudi-green/10 flex items-center justify-center text-isaudi-green">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">{t("billing.currentPlan")}</div>
                  <div className="text-xl font-bold capitalize flex items-center gap-2">
                    {plans.find(p => p.id === user.plan)?.name || user.plan}
                    {user.plan === 'free' && (
                      <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                        {t("billing.freeBadge")}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {user.planExpiresAt ? (
                <div className="text-right">
                  <div className="text-sm text-gray-500 mb-1">{t("billing.expiresAt")}</div>
                  <div className="font-medium">{formatDate(user.planExpiresAt)}</div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">{t("billing.noActive")}</div>
              )}
            </div>
            
            {status === 'processed' && (
              <div className="mt-6 p-4 bg-green-50 text-green-700 rounded-xl flex items-center gap-3 border border-green-100">
                <Check className="w-5 h-5" />
                <span>{t("billing.status.processed")}</span>
              </div>
            )}

            {status === "processed" && verifyError && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100">
                <AlertCircle className="w-5 h-5" />
                <span>{verifyError}</span>
              </div>
            )}
          </div>

          {/* Pricing Section */}
          <div>
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-4">{t("billing.choosePlan")}</h2>
              
              {/* Toggle */}
              <div className="flex items-center justify-center gap-4 mt-8">
                <span className={cn("text-sm font-medium transition-colors", !isYearly ? "text-gray-900" : "text-gray-500")}>
                  {t("billing.toggle.monthly")}
                </span>
                <button
                  onClick={() => setIsYearly(!isYearly)}
                  className="relative w-14 h-8 bg-gray-200 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-isaudi-green"
                >
                  <div 
                    className={cn(
                      "absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300",
                      isYearly ? "translate-x-1" : "translate-x-7"
                    )}
                  />
                </button>
                <span className={cn("text-sm font-medium transition-colors", isYearly ? "text-gray-900" : "text-gray-500")}>
                  {t("billing.toggle.yearly")}
                  <span className="text-isaudi-green text-xs mr-2 font-normal">
                    {t("billing.toggle.save")}
                  </span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan) => {
                const currentPlanIndex = planOrder.indexOf(subscription?.planId || 'free');
                const planIndex = planOrder.indexOf(plan.id);
                const isCurrentPlan = subscription?.planId === plan.id && subscription?.isActiveNow;
                const isUpgrade = planIndex > currentPlanIndex;
                const isDowngrade = planIndex < currentPlanIndex;

                return (
                  <div 
                    key={plan.id}
                    className={cn(
                      "relative bg-white rounded-2xl p-8 border transition-all duration-300",
                      plan.popular ? "border-isaudi-green shadow-lg scale-105 z-10" : "border-gray-100 hover:border-gray-200 hover:shadow-md"
                    )}
                  >
                    {plan.popular && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-isaudi-green text-white px-4 py-1 rounded-full text-sm font-medium">
                        {t("billing.badge.popular")}
                      </div>
                    )}

                    <div className="mb-8">
                      <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                      <p className="text-gray-500 text-sm">{plan.description}</p>
                    </div>

                    <div className="mb-8">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-gray-900">
                          {isYearly ? plan.priceYearly : plan.priceMonthly}
                        </span>
                        <span className="text-gray-500 text-sm">{t("billing.currency")}</span>
                        <span className="text-gray-400 text-sm">
                          / {isYearly ? t("billing.per.year") : t("billing.per.month")}
                        </span>
                      </div>
                    </div>

                    <ul className="space-y-4 mb-8">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                          <Check className="w-5 h-5 text-isaudi-green shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button 
                      className={cn(
                        "w-full py-6 text-lg font-bold",
                        isCurrentPlan || isDowngrade
                          ? "bg-gray-100 text-gray-400 hover:bg-gray-100 cursor-default" 
                          : "bg-isaudi-green hover:bg-isaudi-green-dark text-white"
                      )}
                      onClick={() => !isCurrentPlan && !isDowngrade && handleSubscribe(plan.id)}
                      disabled={isCurrentPlan || isDowngrade || !!loadingPlan}
                    >
                      {loadingPlan === plan.id ? (
                        <Loader2 className="animate-spin" />
                      ) : isCurrentPlan ? (
                        t("billing.button.current")
                      ) : isDowngrade ? (
                        t("billing.button.downgrade")
                      ) : (
                        isYearly ? t("billing.button.subscribeYearly") : t("billing.button.subscribeMonthly")
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </Container>
    </div>
  );
}
