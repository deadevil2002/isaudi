"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  ArrowLeft,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Globe,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { useLanguage } from "@/components/providers/language-provider";
import {
  landingReveal,
  landingRevealReduced,
  landingStagger,
  landingStaggerReduced,
  useLandingReducedMotion,
} from "@/lib/animations";
import { createTranslator } from "@/lib/i18n/translations";

export function Hero() {
  const showcaseRef = useRef<HTMLDivElement>(null);
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const reduceMotion = useLandingReducedMotion();
  const reveal = reduceMotion ? landingRevealReduced : landingReveal;
  const stagger = reduceMotion ? landingStaggerReduced : landingStagger;

  useEffect(() => {
    const showcase = showcaseRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!showcase || reducedMotion.matches) return;

    let animationFrame = 0;
    const updateParallax = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const offset = Math.min(window.scrollY * 0.03, 24);
        showcase.style.setProperty("--landing-parallax-y", `${offset}px`);
      });
    };

    updateParallax();
    window.addEventListener("scroll", updateParallax, { passive: true });
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", updateParallax);
      showcase.style.removeProperty("--landing-parallax-y");
    };
  }, []);

  return (
    <section className="isaudi-grid-bg landing-hero relative flex min-h-[100dvh] items-center overflow-hidden bg-[#06090c] pb-24 pt-28 text-white sm:pt-32">
      <div className="landing-ambient pointer-events-none absolute inset-0" aria-hidden="true">
        <span className="landing-orb landing-orb-teal" />
        <span className="landing-orb landing-orb-gold" />
        <span className="landing-depth-line landing-depth-line-one" />
        <span className="landing-depth-line landing-depth-line-two" />
      </div>

      <Container className="relative z-10">
        <div className="grid items-center gap-16 lg:grid-cols-[.94fr_1.06fr] lg:gap-14">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="min-w-0 text-center lg:text-start"
          >
            <motion.span variants={reveal} className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#e6b95c]/25 bg-[#e6b95c]/[0.08] px-4 py-2 text-sm text-[#d8dee8] shadow-[0_10px_35px_rgba(0,0,0,.22)] backdrop-blur-xl">
              <Sparkles size={16} className="text-[#e6b95c]" aria-hidden="true" />
              {t("hero.badge")}
            </motion.span>

            <h1 className="mb-6 text-balance text-4xl font-bold leading-[1.1] tracking-[-0.038em] sm:text-5xl lg:text-[4rem]">
              <span className="block overflow-hidden pb-1">
                <motion.span variants={reveal} className="block">{t("hero.title.main")}</motion.span>
              </span>
              <span className="block overflow-hidden pb-2">
                <motion.span variants={reveal} className="block bg-gradient-to-r from-[#f9d889] via-[#e6b95c] to-[#0fc9a7] bg-clip-text text-transparent">
                  {t("hero.title.highlight")} {t("hero.title.suffix")}
                </motion.span>
              </span>
            </h1>

            <motion.p variants={reveal} className="mx-auto mb-9 max-w-2xl text-base leading-8 text-[#a4b0c0] sm:text-lg lg:mx-0 lg:max-w-xl">
              {t("hero.subtitle")}
            </motion.p>

            <motion.div variants={reveal} className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link href="/login" className="w-full sm:w-auto">
                <Button size="lg" className="landing-cta w-full rounded-full border-none bg-gradient-to-r from-[#f0cb77] to-[#dbaa49] px-8 text-base text-[#171004] shadow-[0_14px_35px_rgba(230,185,92,.18)]">
                  <ArrowLeft className={`h-5 w-5 ${lang === "en" ? "rotate-180" : ""}`} aria-hidden="true" />
                  {t("hero.cta.freeReport")}
                </Button>
              </Link>
              <Link href="/how-it-works" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full rounded-full px-8 text-base backdrop-blur-xl">
                  <Globe size={20} aria-hidden="true" />
                  {t("hero.cta.how")}
                </Button>
              </Link>
            </motion.div>

            <motion.div variants={reveal} className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-[#94a3b8] lg:justify-start">
              {[t("hero.badge.fast"), t("hero.badge.security")].map((label) => (
                <span key={label} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#0fc9a7]" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </motion.div>
            <motion.p variants={reveal} className="mx-auto mt-4 max-w-xl text-xs leading-6 text-[#728196] lg:mx-0">
              {t("hero.disclaimer")}
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.94, rotateX: 5 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.9, delay: reduceMotion ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="landing-showcase-stage relative mx-auto min-w-0 w-full max-w-2xl [perspective:1400px] lg:mx-0"
            aria-label={lang === "ar" ? "معاينة متحركة لواجهة تحليلات iSaudi" : "Animated preview of the iSaudi analytics interface"}
          >
            <div ref={showcaseRef} className="landing-showcase-parallax">
            <div className="landing-showcase-float relative">
              <div className="landing-browser isaudi-card relative overflow-hidden rounded-[1.75rem] p-3 sm:p-4">
                <div className="landing-showcase-sheen pointer-events-none absolute inset-0" aria-hidden="true" />
                <div className="relative z-10 overflow-hidden rounded-[1.25rem] border border-white/[.08] bg-[#080d12]">
                  <div className="flex h-10 items-center justify-between border-b border-white/[.08] bg-white/[.025] px-4" aria-hidden="true">
                    <div className="flex gap-1.5"><span className="h-2 w-2 rounded-full bg-[#fb7185]/70" /><span className="h-2 w-2 rounded-full bg-[#e6b95c]/70" /><span className="h-2 w-2 rounded-full bg-[#0fc9a7]/70" /></div>
                    <span className="h-1.5 w-24 rounded-full bg-white/[.07]" />
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#0fc9a7]/25 bg-[#0fc9a7]/10 text-[#20d4b2] shadow-[0_0_30px_rgba(15,201,167,.12)]">
                          <BrainCircuit className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0"><p className="text-sm font-bold text-white">iSaudi Intelligence</p><p className="truncate text-xs text-[#94a3b8]">{t("hero.badge")}</p></div>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full border border-[#0fc9a7]/20 bg-[#0fc9a7]/10 px-3 py-1 text-xs font-semibold text-[#72ead4]">
                        <span className="landing-live-dot h-1.5 w-1.5 rounded-full bg-[#20d4b2]" aria-hidden="true" />
                        {t("hero.badge.fast")}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {[
                        { label: t("hero.mock.totalSales"), icon: BarChart3, tone: "text-white" },
                        { label: t("hero.mock.expectedProfit"), icon: TrendingUp, tone: "text-[#20d4b2]" },
                        { label: t("hero.mock.competitorAnalysis"), icon: Sparkles, tone: "text-[#e6b95c]" },
                      ].map(({ label, icon: Icon, tone }, index) => (
                        <motion.div key={label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.65 + index * 0.08 }} className="landing-feature-card rounded-xl border border-white/[.08] bg-white/[0.035] p-3 sm:rounded-2xl sm:p-4">
                          <Icon className={`mb-3 h-4 w-4 sm:h-5 sm:w-5 ${tone}`} aria-hidden="true" />
                          <p className="text-[11px] font-semibold leading-5 text-[#dce3eb] sm:text-sm sm:leading-6">{label}</p>
                        </motion.div>
                      ))}
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-[1.35fr_.65fr]">
                      <div className="rounded-2xl border border-white/[.08] bg-[#060a0f] p-4" aria-hidden="true">
                        <div className="mb-3 flex items-center justify-between"><span className="h-2 w-24 rounded-full bg-white/10" /><span className="h-2 w-10 rounded-full bg-[#0fc9a7]/25" /></div>
                        <svg viewBox="0 0 360 128" className="h-28 w-full overflow-visible" preserveAspectRatio="none">
                          <defs><linearGradient id="hero-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#20d4b2" stopOpacity=".28" /><stop offset="1" stopColor="#20d4b2" stopOpacity="0" /></linearGradient></defs>
                          <path d="M0 110 C45 104 54 64 102 76 C145 87 155 40 202 51 C246 62 258 28 306 38 C329 42 344 22 360 14 L360 128 L0 128 Z" fill="url(#hero-chart-fill)" />
                          <motion.path d="M0 110 C45 104 54 64 102 76 C145 87 155 40 202 51 C246 62 258 28 306 38 C329 42 344 22 360 14" fill="none" stroke="#20d4b2" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 1.35, delay: reduceMotion ? 0 : 0.85, ease: [0.22, 1, 0.36, 1] }} />
                          <circle cx="360" cy="14" r="4" fill="#f9d889" />
                        </svg>
                      </div>
                      <div className="rounded-2xl border border-[#e6b95c]/15 bg-[#e6b95c]/[.055] p-4">
                        <Sparkles className="mb-3 h-5 w-5 text-[#e6b95c]" aria-hidden="true" />
                        <p className="text-xs font-semibold leading-6 text-[#e8edf3]">{t("sample.insight.title")}</p>
                        <div className="mt-3 space-y-2" aria-hidden="true"><span className="block h-1.5 w-full rounded-full bg-white/10" /><span className="block h-1.5 w-4/5 rounded-full bg-white/[.07]" /><span className="block h-1.5 w-3/5 rounded-full bg-[#e6b95c]/20" /></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="landing-float-card landing-float-card-gold hidden items-center gap-3 rounded-2xl border border-[#e6b95c]/20 bg-[#10161d]/95 p-3 shadow-2xl backdrop-blur-xl sm:flex" aria-hidden="true">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e6b95c]/10 text-[#e6b95c]"><TrendingUp className="h-4 w-4" /></span>
                <span><strong className="block text-sm text-white">+12%</strong><small className="text-[11px] text-[#94a3b8]">{t("sample.stat1.deltaLabel")}</small></span>
              </div>
              <div className="landing-float-card landing-float-card-teal hidden items-center gap-3 rounded-2xl border border-[#0fc9a7]/20 bg-[#10161d]/95 p-3 shadow-2xl backdrop-blur-xl sm:flex" aria-hidden="true">
                <span className="landing-live-dot h-2 w-2 rounded-full bg-[#20d4b2]" />
                <small className="text-xs font-semibold text-[#72ead4]">{t("hero.badge.fast")}</small>
              </div>
            </div>
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
