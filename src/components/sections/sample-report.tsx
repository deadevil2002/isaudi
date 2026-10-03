"use client";

import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { TrendingUp, LayoutDashboard, LineChart, WalletCards, Settings, Sparkles } from "lucide-react";
import Image from "next/image";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import {
  landingReveal,
  landingRevealReduced,
  landingStagger,
  landingStaggerReduced,
  useLandingReducedMotion,
} from "@/lib/animations";
import Link from "next/link";

export function SampleReport() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const reduceMotion = useLandingReducedMotion();
  const reveal = reduceMotion ? landingRevealReduced : landingReveal;
  const stagger = reduceMotion ? landingStaggerReduced : landingStagger;

  return (
    <section className="landing-section-glow relative overflow-hidden bg-[#0e1218] py-32" id="features">
      <Container className="relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="mb-16 text-center"
        >
          <motion.h2 variants={reveal} className="mb-6 text-3xl font-bold text-white lg:text-4xl">
            {t("sample.heading")} <span className="text-[#e6b95c]">{t("sample.heading.highlight")}</span>
          </motion.h2>
          <motion.p variants={reveal} className="mx-auto max-w-2xl text-lg text-[#94a3b8]">
            {t("sample.subtitle")}
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={reveal}
          className="rounded-[2rem] border border-white/[.08] bg-[#090d12]/70 p-3 shadow-[0_40px_100px_rgba(0,0,0,.3)] backdrop-blur-sm sm:p-5"
        >
          <div className="mb-5 flex items-center justify-between border-b border-white/[.07] pb-4" aria-hidden="true"><div className="flex gap-1.5"><span className="h-2 w-2 rounded-full bg-[#fb7185]/60" /><span className="h-2 w-2 rounded-full bg-[#e6b95c]/60" /><span className="h-2 w-2 rounded-full bg-[#0fc9a7]/60" /></div><span className="h-1.5 w-28 rounded-full bg-white/[.06]" /></div>
          <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-8">
            {/* Sidebar Shell */}
            <aside className="hidden lg:flex bg-[#06090c] border border-white/10 rounded-[1rem] p-6 flex-col gap-2">
              <div className="relative w-24 h-8 mb-4 pb-4 border-b border-white/10 mx-auto">
                <Image src="/brand/design-preview-logo.png" alt="isaudi.ai" fill className="object-contain" />
              </div>
              <div className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#0fc9a7]/10 text-[#0fc9a7] font-medium">
                <LayoutDashboard size={20} />
                <span>{t("dashboard.menu.dashboard")}</span>
              </div>
              <div className="w-full flex items-center gap-3 p-3 rounded-xl text-[#94a3b8] opacity-70">
                <LineChart size={20} />
                <span>{t("dashboard.menu.reports")}</span>
              </div>
              <div className="w-full flex items-center gap-3 p-3 rounded-xl text-[#94a3b8] opacity-70">
                <WalletCards size={20} />
                <span>{t("dashboard.menu.costs")}</span>
              </div>
              <div className="w-full flex items-center gap-3 p-3 rounded-xl text-[#94a3b8] opacity-70">
                <Settings size={20} />
                <span>{t("dashboard.menu.settings")}</span>
              </div>
            </aside>

            {/* Main Content */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="landing-interactive-card bg-[#06090c] border border-white/10 rounded-2xl p-6">
                  <div className="text-[#94a3b8] text-sm mb-2">{t("sample.stat1.label")}</div>
                  <div className="text-3xl font-bold text-white mb-2 flex items-baseline gap-1">
                    42,500 <span className="text-sm text-[#64748b]">SAR</span>
                  </div>
                  <div className="inline-flex items-center gap-1 text-sm text-[#0fc9a7]">
                    <TrendingUp size={16} /> 12% {t("sample.stat1.deltaLabel")}
                  </div>
                </div>
                <div className="landing-interactive-card bg-[#06090c] border border-white/10 rounded-2xl p-6">
                  <div className="text-[#94a3b8] text-sm mb-2">{t("sample.stat2.label")}</div>
                  <div className="text-3xl font-bold text-white mb-2">185</div>
                  <div className="inline-flex items-center gap-1 text-sm text-[#0fc9a7]">
                    <TrendingUp size={16} /> 5.2%
                  </div>
                </div>
                <div className="landing-interactive-card bg-[#06090c] border border-white/10 rounded-2xl p-6">
                  <div className="text-[#94a3b8] text-sm mb-2">{t("sample.stat3.label")}</div>
                  <div className="text-3xl font-bold text-white mb-2">2.4%</div>
                  <div className="inline-flex items-center gap-1 text-sm text-[#ef4444]">
                    <TrendingUp size={16} className="rotate-180" /> {t("sample.stat3.note")}
                  </div>
                </div>
              </div>

              {/* Report sample and grounded insight */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#06090c] border border-white/10 rounded-[1.5rem] p-0 overflow-hidden">
                  <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-white">{t("sample.heading")}</h3>
                  </div>
                  <div className="h-[250px] bg-[#0e1218] mt-4 flex items-end p-4 gap-4">
                    {[40, 60, 45, 80, 50, 90, 70].map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ scaleY: 0, opacity: .35 }}
                        whileInView={{ scaleY: 1, opacity: .82 }}
                        viewport={{ once: true }}
                        transition={{ duration: reduceMotion ? 0 : .62, delay: reduceMotion ? 0 : i * .055, ease: [0.22, 1, 0.36, 1] }}
                        className="flex-1 origin-bottom rounded-t-sm bg-gradient-to-t from-[#0a997e] to-[#0fc9a7] transition-opacity hover:opacity-100"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="bg-[#161c24] rounded-[1.5rem] p-6 border border-white/10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#e6b95c]/10 flex items-center justify-center">
                      <Sparkles className="text-[#e6b95c]" size={20} />
                    </div>
                    <h3 className="font-bold text-lg text-white">{t("sample.insight.title")}</h3>
                  </div>

                  <div className="space-y-6">
                    <div className="p-4 bg-[#06090c] rounded-xl border border-white/10">
                      <p className="text-sm text-[#94a3b8] leading-relaxed mb-4">
                        {t("sample.insight.body")}
                      </p>
                      <Button asChild size="sm" className="landing-cta w-full rounded-full border border-white/10 bg-[#1d252f] text-white hover:bg-[#161c24]">
                        <Link href="/login">{t("sample.insight.cta")}</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
