"use client";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Globe, ArrowLeft, Sparkles, BarChart3, BrainCircuit, CheckCircle2, TrendingUp } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

export function Hero() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const reduceMotion = useReducedMotion();

  return (
    <section className="isaudi-grid-bg relative flex min-h-[100dvh] items-center overflow-hidden bg-[#06090c] pb-20 pt-28 text-white sm:pt-32">
      {/* Background Ambient Effect */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10" style={{
        background: "radial-gradient(circle at 50% 0%, rgba(15, 201, 167, 0.15) 0%, transparent 50%), radial-gradient(circle at 100% 50%, rgba(230, 185, 92, 0.15) 0%, transparent 40%)"
      }} />

      <Container className="relative z-10">
        <div className="grid items-center gap-14 lg:grid-cols-[1.03fr_.97fr] lg:gap-16">
          <motion.div
            initial={false}
            animate={reduceMotion ? undefined : { opacity: [0, 1], y: [8, 0] }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="text-center lg:text-start"
          >
            <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#e6b95c]/20 bg-[#e6b95c]/[0.07] px-4 py-2 text-sm text-[#d8dee8]">
              <Sparkles size={16} className="text-[#e6b95c]" />
              {t("hero.badge")}
            </span>
            
            <h1 className="mb-6 text-balance text-4xl font-bold leading-[1.12] tracking-[-0.035em] sm:text-5xl lg:text-[4rem]">
              {t("hero.title.main")} <br className="hidden sm:block" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#f9d889] to-[#e6b95c]">
                {t("hero.title.highlight")}
              </span>{" "}
              {t("hero.title.suffix")}
            </h1>
            
            <p className="mx-auto mb-9 max-w-2xl text-base leading-8 text-[#a4b0c0] sm:text-lg lg:mx-0 lg:max-w-xl">
              {t("hero.subtitle")}
            </p>
            
            <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link href="/login" className="w-full sm:w-auto">
                <Button size="lg" className="w-full rounded-full border-none bg-gradient-to-r from-[#f0cb77] to-[#dbaa49] px-8 text-base text-[#171004] shadow-[0_14px_35px_rgba(230,185,92,.16)] hover:brightness-105">
                  <ArrowLeft className={`h-5 w-5 ${lang === "en" ? "rotate-180" : ""}`} aria-hidden="true" />
                  {t("hero.cta.freeReport")}
                </Button>
              </Link>
              <Link href="/how-it-works" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full rounded-full px-8 text-base">
                  <Globe size={20} />
                  {t("hero.cta.how")}
                </Button>
              </Link>
            </div>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-[#94a3b8] lg:justify-start">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#0fc9a7]" aria-hidden="true" />
                {t("hero.badge.fast")}
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#0fc9a7]" aria-hidden="true" />
                {t("hero.badge.security")}
              </span>
            </div>
            <p className="mx-auto mt-4 max-w-xl text-xs leading-6 text-[#728196] lg:mx-0">
              {t("hero.disclaimer")}
            </p>
          </motion.div>

          <motion.div
            initial={false}
            animate={reduceMotion ? undefined : { opacity: [0, 1], y: [14, 0], scale: [0.99, 1] }}
            transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="isaudi-card mx-auto w-full max-w-xl p-4 sm:p-6 lg:mx-0"
            aria-label={lang === "ar" ? "معاينة تجربة التحليل الذكي" : "Smart analytics experience preview"}
          >
            <div className="pointer-events-none absolute -end-20 -top-20 h-56 w-56 rounded-full bg-[#0fc9a7]/10 blur-3xl" />
            <div className="relative z-10">
              <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#0fc9a7]/20 bg-[#0fc9a7]/10 text-[#20d4b2]">
                    <BrainCircuit className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">iSaudi Intelligence</p>
                    <p className="truncate text-xs text-[#94a3b8]">{t("hero.badge")}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#0fc9a7]/20 bg-[#0fc9a7]/10 px-3 py-1 text-xs font-semibold text-[#72ead4]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#20d4b2]" />
                  {t("hero.badge.fast")}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: t("hero.mock.totalSales"), icon: BarChart3, tone: "text-white" },
                  { label: t("hero.mock.expectedProfit"), icon: TrendingUp, tone: "text-[#20d4b2]" },
                  { label: t("hero.mock.competitorAnalysis"), icon: Sparkles, tone: "text-[#e6b95c]" },
                ].map(({ label, icon: Icon, tone }) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <Icon className={`mb-4 h-5 w-5 ${tone}`} aria-hidden="true" />
                    <p className="text-sm font-semibold leading-6 text-[#dce3eb]">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-[#090d12] p-4" aria-hidden="true">
                <div className="mb-4 flex items-center justify-between">
                  <span className="h-2 w-28 rounded-full bg-white/10" />
                  <span className="h-2 w-12 rounded-full bg-[#0fc9a7]/25" />
                </div>
                <div className="flex h-28 items-end gap-2">
                  {[42, 58, 48, 76, 64, 88, 72].map((height, index) => (
                    <span
                      key={height + index}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-[#0fc9a7]/25 to-[#20d4b2]"
                      style={{ height: `${height}%`, opacity: 0.58 + index * 0.05 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
