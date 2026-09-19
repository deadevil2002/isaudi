"use client";

import { useState } from "react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeIn } from "@/lib/animations";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import type { User } from "@/lib/db/client";
import type { SubscriptionEntitlements } from "@/lib/subscription/types";
import { comparePlans, type PlanId } from "@/lib/subscription/plans";

const plans = [
  {
    id: "starter",
    priceMonthly: 199,
    priceYearly: 1999,
    popular: false,
    nameKey: "billing.plan.basic",
    descriptionKey: "pricing.plan.starter.description",
    featureKeys: [
      "pricing.plan.starter.feature1",
      "pricing.plan.starter.feature2",
      "pricing.plan.starter.feature3",
      "pricing.plan.starter.feature4",
      "pricing.plan.starter.feature5",
    ],
    notIncludedKeys: [
      "pricing.plan.starter.notIncluded1",
      "pricing.plan.starter.notIncluded2",
    ],
  },
  {
    id: "growth",
    priceMonthly: 399,
    priceYearly: 3999,
    popular: true,
    nameKey: "billing.plan.pro",
    descriptionKey: "pricing.plan.growth.description",
    featureKeys: [
      "pricing.plan.growth.feature1",
      "pricing.plan.growth.feature2",
      "pricing.plan.growth.feature3",
      "pricing.plan.growth.feature4",
      "pricing.plan.growth.feature5",
    ],
    notIncludedKeys: [] as string[],
  },
  {
    id: "business",
    priceMonthly: 899,
    priceYearly: 8999,
    popular: false,
    nameKey: "billing.plan.business",
    descriptionKey: "pricing.plan.business.description",
    featureKeys: [
      "pricing.plan.business.feature1",
      "pricing.plan.business.feature2",
      "pricing.plan.business.feature3",
      "pricing.plan.business.feature4",
    ],
    notIncludedKeys: [] as string[],
  },
];

export function Pricing({
  user,
  subscription,
  compact = false,
}: {
  user: User | null;
  subscription: SubscriptionEntitlements | null;
  compact?: boolean;
}) {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  return (
    <section className={cn("bg-transparent", compact ? "py-12 md:py-16" : "py-32")} id="pricing">
      <Container>
        <div className={cn("text-center", compact ? "mb-12" : "mb-16")}>
          <motion.h2
            initial={compact ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-3xl md:text-5xl font-bold text-white mb-6"
          >
            {t("pricing.title")}
          </motion.h2>
          <motion.p
            initial={compact ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-[#94a3b8] mb-10 text-lg max-w-2xl mx-auto"
          >
            {t("pricing.subtitle")}
          </motion.p>

          {/* Toggle */}
          <div className="flex flex-col items-center justify-center mb-12">
            <div
              role="radiogroup"
              aria-label={t("billing.toggle.aria")}
              data-pricing-interval={isYearly ? "year" : "month"}
              className="flex max-w-full items-center justify-center rounded-full bg-[#161c24] p-1 border border-white/10"
            >
              <label
                onClick={() => setIsYearly(false)}
                className={cn(
                  "relative cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 focus-within:ring-2 focus-within:ring-[#e6b95c]/70 focus-within:ring-offset-2 focus-within:ring-offset-[#06090c]",
                  !isYearly ? "bg-[#0fc9a7] text-[#02110e]" : "text-[#94a3b8] hover:text-white"
                )}
              >
                <input
                  type="radio"
                  name="pricing-interval"
                  value="monthly"
                  checked={!isYearly}
                  onChange={() => setIsYearly(false)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span className="pointer-events-none">{t("pricing.monthly")}</span>
              </label>
              <label
                onClick={() => setIsYearly(true)}
                className={cn(
                  "relative flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 focus-within:ring-2 focus-within:ring-[#e6b95c]/70 focus-within:ring-offset-2 focus-within:ring-offset-[#06090c]",
                  isYearly ? "bg-[#0fc9a7] text-[#02110e]" : "text-[#94a3b8] hover:text-white"
                )}
              >
                <input
                  type="radio"
                  name="pricing-interval"
                  value="yearly"
                  checked={isYearly}
                  onChange={() => setIsYearly(true)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span className="pointer-events-none">{t("pricing.yearly")}</span>
              </label>
            </div>
          </div>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-start max-w-6xl mx-auto px-4 sm:px-0"
          onMouseLeave={() => setHoveredPlan(null)}
        >
          {plans.map((plan) => {
            const activePlanId = hoveredPlan ?? selectedPlan;
            const isActive = activePlanId === plan.id;
            const slug = plan.id;
            const interval = isYearly ? "year" : "month";

            const currentPlanId = subscription?.planId || 'free';
            const isCurrentPlan = plan.id === currentPlanId && subscription?.isActiveNow;
            const isDowngrade = comparePlans(plan.id as PlanId, currentPlanId as PlanId) < 0;

            let buttonText = t("pricing.choosePlan");
            let buttonDisabled = false;
            let buttonHref = user ? `/billing?plan=${slug}&interval=${interval}` : `/login`;

            if (isCurrentPlan) {
              buttonText = t("billing.currentPlan");
              buttonDisabled = true;
              buttonHref = "/billing";
            } else if (isDowngrade) {
              buttonText = t("billing.button.downgrade");
              buttonDisabled = true;
            } else if (user) {
              buttonText = t("dashboard.plan.upgrade");
            } else {
              buttonText = t("pricing.subscribe");
            }

            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedPlan(plan.id);
                  }
                }}
                tabIndex={0}
                className={cn(
                  "relative flex flex-col p-8 rounded-[1.5rem] transition-all duration-300 cursor-pointer overflow-hidden",
                  isActive
                    ? "border border-[#e6b95c] bg-gradient-to-b from-[#0e1218] to-[rgba(230,185,92,0.05)] shadow-2xl scale-[1.02]"
                    : "bg-[#0e1218] border border-white/10"
                )}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-[#e6b95c] text-black px-4 py-1 rounded-full text-xs font-bold shadow-md">
                    {t("pricing.mostPopular")}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">
                    {t(plan.nameKey)}
                  </h3>
                  <p className="text-[#94a3b8] text-sm mb-6">
                    {t(plan.descriptionKey)}
                  </p>
                  <div className={cn("flex items-baseline gap-2", lang === "ar" ? "dir-rtl" : "dir-ltr")}>
                    <span className="text-4xl font-bold text-white">
                      {isYearly ? plan.priceYearly : plan.priceMonthly}
                    </span>
                    <span className="text-[#64748b] text-sm">
                      {t("pricing.currency")} / {isYearly ? t("pricing.perYear") : t("pricing.perMonth")}
                    </span>
                  </div>
                </div>

                <ul className="space-y-4 mb-8 flex-1">
                  {plan.featureKeys.map((key, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-[#94a3b8]">
                      <Check className="w-5 h-5 text-[#0fc9a7] shrink-0" />
                      <span>{t(key)}</span>
                    </li>
                  ))}
                  {plan.notIncludedKeys.map((key, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-[#64748b] opacity-60">
                      <X className="w-5 h-5 shrink-0" />
                      <span>{t(key)}</span>
                    </li>
                  ))}
                </ul>

                <Link href={buttonHref} className="w-full">
                  <Button
                    disabled={buttonDisabled}
                    className={cn(
                      "w-full transition-all duration-300 rounded-full font-semibold border-none py-6",
                      isActive
                        ? "bg-gradient-to-r from-[#c5993c] to-[#e6b95c] text-black hover:opacity-90"
                        : "bg-[#1d252f] text-white hover:bg-[#161c24] border border-white/10"
                    )}
                  >
                    {buttonText}
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
          className="text-center text-[#64748b] text-xs mt-16 max-w-2xl mx-auto space-y-3"
        >
          <p className="font-medium text-[#0fc9a7]">
            {t("pricing.note1")}
          </p>
          <p>
            {t("pricing.note2")}
          </p>
          <p>
            {t("pricing.note3")}
          </p>
        </motion.div>
      </Container>
    </section>
  );
}
