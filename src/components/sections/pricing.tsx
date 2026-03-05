"use client";

import { useState } from "react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeIn, staggerContainer } from "@/lib/animations";
import Image from "next/image";
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

export function Pricing({ user, subscription }: { user: User | null, subscription: SubscriptionEntitlements | null }) {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("growth"); // Default to middle plan
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  return (
    <section className="py-20 bg-white" id="pricing">
      <Container>
        <div className="text-center mb-12">
          <motion.h2 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
          >
            {t("pricing.title")}
          </motion.h2>
          <motion.p 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-gray-600 mb-8"
          >
            {t("pricing.subtitle")}
          </motion.p>

          {/* Toggle */}
          <div className="flex items-center justify-center mb-12">
            <div className="flex items-center gap-4 px-4 py-2 rounded-full border border-isaudi-green/60 bg-white shadow-sm">
              <span className={cn("text-sm font-semibold transition-colors", !isYearly ? "text-isaudi-green" : "text-gray-600")}>
              {t("pricing.monthly")}
              </span>
              <button
              onClick={() => setIsYearly(!isYearly)}
              className="relative w-16 h-8 bg-gray-200 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-isaudi-green border border-isaudi-green/60"
            >
              <div 
                className={cn(
                  "absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 border border-isaudi-green/60",
                )}
                style={{ 
                    // Manual override to ensure correct movement
                    transform: isYearly ? "translateX(-28px)" : "translateX(0)",
                    right: "6px" // Start from right
                }}
              />
              </button>
              <span className={cn("text-sm font-semibold transition-colors", isYearly ? "text-isaudi-green" : "text-gray-600")}>
              {t("pricing.yearly")}{" "}
              <span className="text-isaudi-green text-xs font-bold">
                {t("pricing.yearlyBadge")}
              </span>
              </span>
            </div>
          </div>
        </div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
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
              buttonText = lang === "ar" ? "غير متاح الرجوع لأقل" : "Downgrade not available";
              buttonDisabled = true;
            } else if (user) {
              buttonText = t("dashboard.plan.upgrade");
            } else {
              buttonText = lang === "ar" ? "اشترك" : "Subscribe";
            }


            return (
              <motion.div
                key={plan.id}
                variants={fadeIn}
                onClick={() => setSelectedPlan(plan.id)}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                // Add keyboard support for accessibility
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedPlan(plan.id);
                  }
                }}
                tabIndex={0}
                className={cn(
                  "relative flex flex-col p-8 rounded-2xl border transition-all duration-300 cursor-pointer will-change-transform",
                  // Active state styling (Hover or Selected) - Exclusive "Featured" look
                  isActive
                    ? "scale-105 md:scale-110 border-isaudi-green shadow-2xl -translate-y-[6px] ring-1 ring-isaudi-green bg-white z-20"
                    : "bg-white border-gray-100 shadow-md hover:shadow-lg z-0"
                )}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-isaudi-green text-white px-4 py-1 rounded-full text-sm font-bold shadow-md">
                    {t("pricing.mostPopular")}
                  </div>
                )}

                <div className="mb-8 text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {t(plan.nameKey)}
                  </h3>
                  <p className="text-gray-500 text-sm mb-6">
                    {t(plan.descriptionKey)}
                  </p>
                  <div className={cn("flex items-baseline justify-center gap-2", lang === "ar" ? "dir-rtl" : "dir-ltr")}>
                    <span className="text-4xl font-bold text-gray-900">
                      {isYearly ? plan.priceYearly : plan.priceMonthly}
                    </span>
                    <span className="text-base font-medium text-gray-500">
                      {t("pricing.currency")}
                    </span>
                    <span className="text-gray-400 text-sm">
                      / {isYearly ? t("pricing.perYear") : t("pricing.perMonth")}
                    </span>
                  </div>
                </div>

                <ul className="space-y-4 mb-8 flex-1">
                  {plan.featureKeys.map((key, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                      <Check className="w-5 h-5 text-isaudi-green shrink-0" />
                      <span>{t(key)}</span>
                    </li>
                  ))}
                  {plan.notIncludedKeys.map((key, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-400">
                      <X className="w-5 h-5 text-gray-300 shrink-0" />
                      <span>{t(key)}</span>
                    </li>
                  ))}
                </ul>

                <Link href={buttonHref} className="w-full">
                  <Button 
                    disabled={buttonDisabled}
                    className={cn(
                      "w-full transition-colors duration-300",
                      isActive 
                        ? "bg-isaudi-green hover:bg-isaudi-green-dark text-white border-transparent" 
                        : "bg-gray-900 hover:bg-gray-800 text-white border-transparent"
                    )}
                    variant={isActive ? "default" : "outline"}
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
          variants={fadeIn}
          className="text-center text-gray-400 text-xs mt-12 max-w-2xl mx-auto space-y-3"
        >
          <p className="font-medium text-isaudi-green">
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
