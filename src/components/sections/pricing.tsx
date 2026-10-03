"use client";

import { useState } from "react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  landingCardStagger,
  landingReveal,
  landingRevealReduced,
  landingSectionRevealReduced,
  useLandingReducedMotion,
} from "@/lib/animations";
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
  const reduceMotion = useLandingReducedMotion();
  const reveal = reduceMotion ? landingRevealReduced : landingReveal;
  const cardStagger = reduceMotion ? landingSectionRevealReduced : landingCardStagger;

  return (
    <section className={cn("landing-section-glow bg-transparent", compact ? "py-12 md:py-16" : "py-32")} id="pricing">
      <Container>
        <div className={cn("text-center", compact ? "mb-12" : "mb-16")}>
          <motion.h2
            initial={compact ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true }}
            variants={reveal}
            className="text-3xl md:text-5xl font-bold text-white mb-6"
          >
            {t("pricing.title")}
          </motion.h2>
          <motion.p
            initial={compact ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true }}
            variants={reveal}
            className="text-[#94a3b8] mb-10 text-lg max-w-2xl mx-auto"
          >
            {t("pricing.subtitle")}
          </motion.p>

          {/* Toggle */}
          <div className="mb-12 flex flex-col items-center justify-center">
            <div
              role="radiogroup"
              aria-label={t("billing.toggle.aria")}
              data-pricing-interval={isYearly ? "year" : "month"}
              className="isaudi-surface flex max-w-full items-center justify-center rounded-2xl p-1"
            >
              <button
                type="button"
                role="radio"
                aria-checked={!isYearly}
                onClick={() => setIsYearly(false)}
                className={cn(
                  "relative min-h-11 cursor-pointer rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6b95c]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06090c]",
                  !isYearly ? "bg-[#0fc9a7] text-[#02110e]" : "text-[#94a3b8] hover:text-white"
                )}
              >
                {t("pricing.monthly")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={isYearly}
                onClick={() => setIsYearly(true)}
                className={cn(
                  "relative flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6b95c]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06090c]",
                  isYearly ? "bg-[#0fc9a7] text-[#02110e]" : "text-[#94a3b8] hover:text-white"
                )}
              >
                {t("pricing.yearly")}
              </button>
            </div>
            <span className="sr-only" aria-live="polite">
              {isYearly ? t("pricing.yearly") : t("pricing.monthly")}
            </span>
          </div>
        </div>

        <motion.div
          initial={compact ? false : "hidden"}
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={cardStagger}
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
              <motion.div
                key={plan.id}
                variants={reveal}
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
                  "isaudi-card isaudi-focus landing-interactive-card relative flex cursor-pointer flex-col p-6 transition-all duration-300 sm:p-8",
                  isActive
                    ? "border-[#e6b95c]/55 bg-gradient-to-b from-[#151b23] to-[rgba(230,185,92,0.055)] shadow-[0_24px_70px_rgba(0,0,0,.34)] -translate-y-1"
                    : "hover:border-white/20"
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
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        key={isYearly ? "year" : "month"}
                        initial={reduceMotion ? false : { opacity: 0.65, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
                        transition={{ duration: reduceMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
                        className="isaudi-data-number text-4xl font-bold text-white"
                      >
                        {(isYearly ? plan.priceYearly : plan.priceMonthly).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US")}
                      </motion.span>
                    </AnimatePresence>
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
                        ? "landing-cta bg-gradient-to-r from-[#c5993c] to-[#e6b95c] text-black hover:opacity-90"
                        : "bg-[#1d252f] text-white hover:bg-[#161c24] border border-white/10"
                    )}
                  >
                    {buttonText}
                  </Button>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={reveal}
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
