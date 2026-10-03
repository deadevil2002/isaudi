"use client";

import { motion } from "framer-motion";
import { Lock, Server, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { useLanguage } from "@/components/providers/language-provider";
import {
  landingCardStagger,
  landingReveal,
  landingRevealReduced,
  landingStagger,
  landingStaggerReduced,
  useLandingReducedMotion,
} from "@/lib/animations";
import { createTranslator } from "@/lib/i18n/translations";

export function Trust() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const reduceMotion = useLandingReducedMotion();
  const reveal = reduceMotion ? landingRevealReduced : landingReveal;
  const stagger = reduceMotion ? landingStaggerReduced : landingStagger;
  const cardStagger = reduceMotion ? landingStaggerReduced : landingCardStagger;
  const cards = [
    { title: t("trust.card1.title"), body: t("trust.card1.body"), Icon: ShieldCheck, tone: "text-[#0fc9a7] bg-[#0fc9a7]/10" },
    { title: t("trust.card2.title"), body: t("trust.card2.body"), Icon: Lock, tone: "text-[#e6b95c] bg-[#e6b95c]/10" },
    { title: t("trust.card3.title"), body: t("trust.card3.body"), Icon: Server, tone: "text-[#72ead4] bg-[#0a997e]/10" },
  ];

  return (
    <section className="landing-section-glow bg-[#06090c] py-24">
      <Container>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="mb-12 text-center">
          <motion.h2 variants={reveal} className="mb-4 text-2xl font-bold text-white md:text-3xl">{t("trust.heading")}</motion.h2>
          <motion.p variants={reveal} className="mx-auto max-w-2xl text-[#94a3b8]">{t("trust.subtitle")}</motion.p>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={cardStagger} className="mb-20 grid grid-cols-2 gap-4 opacity-80 md:grid-cols-4 md:gap-6">
          {["Salla", "Zid", "Shopify", "Mada"].map((name) => (
            <motion.div key={name} variants={reveal} className="landing-interactive-card flex h-16 items-center justify-center rounded-xl border border-white/10 bg-[#0e1218] text-base font-bold text-[#94a3b8] hover:text-white md:text-xl">{name}</motion.div>
          ))}
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={cardStagger} className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {cards.map(({ title, body, Icon, tone }) => (
            <motion.article key={title} variants={reveal} className="landing-interactive-card flex flex-col items-center rounded-2xl border border-white/5 bg-[#161c24] p-8 text-center">
              <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full ${tone}`}><Icon className="h-6 w-6" aria-hidden="true" /></div>
              <h3 className="mb-3 text-lg font-bold text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-[#94a3b8]">{body}</p>
            </motion.article>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
