"use client";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Globe, ArrowLeft, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

export function Hero() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative min-h-[100dvh] flex items-center pt-32 pb-20 overflow-hidden bg-[#06090c] text-white">
      {/* Background Ambient Effect */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10" style={{
        background: "radial-gradient(circle at 50% 0%, rgba(15, 201, 167, 0.15) 0%, transparent 50%), radial-gradient(circle at 100% 50%, rgba(230, 185, 92, 0.15) 0%, transparent 40%)"
      }} />

      <Container>
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={false}
            animate={reduceMotion ? undefined : { opacity: [0, 1], y: [8, 0] }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <div className="flex justify-center mb-8">
              <div className="relative w-[min(15rem,58vw)] h-32 opacity-90 drop-shadow-[0_18px_35px_rgba(230,185,92,0.13)]">
                <Image 
                  src="/brand/design-preview-logo.png"
                  alt="isaudi.ai Logo" 
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#161c24] border border-white/10 text-sm text-[#94a3b8] mb-8">
              <Sparkles size={16} className="text-[#e6b95c]" />
              {t("hero.badge")}
            </span>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              {t("hero.title.main")} <br className="hidden md:block" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#f9d889] to-[#e6b95c]">
                {t("hero.title.highlight")}
              </span>{" "}
              {t("hero.title.suffix")}
            </h1>
            
            <p className="text-lg md:text-xl text-[#94a3b8] mb-10 max-w-2xl mx-auto leading-relaxed">
              {t("hero.subtitle")}
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/login" className="w-full sm:w-auto">
                <Button size="lg" className="w-full bg-gradient-to-r from-[#c5993c] to-[#e6b95c] hover:opacity-90 text-black border-none text-lg px-8 py-6 rounded-full shadow-lg">
                  <ArrowLeft className="w-5 h-5 ml-2" />
                  {t("hero.cta.freeReport")}
                </Button>
              </Link>
              <Link href="/how-it-works" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full bg-[#1d252f] hover:bg-[#161c24] text-white border-white/10 text-lg px-8 py-6 rounded-full gap-2">
                  <Globe size={20} />
                  {t("hero.cta.how")}
                </Button>
              </Link>
            </div>

            <div className="mt-12 flex items-center justify-center gap-6 text-sm text-[#64748b]">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                {t("hero.badge.fast")}
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                {t("hero.badge.security")}
              </span>
            </div>
            <p className="text-xs text-[#64748b] mt-4">
              {t("hero.disclaimer")}
            </p>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
