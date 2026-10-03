"use client";

import { motion } from "framer-motion";
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

export function HowItWorks() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const reduceMotion = useLandingReducedMotion();
  const reveal = reduceMotion ? landingRevealReduced : landingReveal;
  const stagger = reduceMotion ? landingStaggerReduced : landingStagger;
  const cardStagger = reduceMotion ? landingStaggerReduced : landingCardStagger;
  const steps = [
    { id: "01", title: t("how.step1.title"), description: t("how.step1.description") },
    { id: "02", title: t("how.step2.title"), description: t("how.step2.description") },
    { id: "03", title: t("how.step3.title"), description: t("how.step3.description") },
  ];

  return (
    <section className="landing-section-glow bg-[#06090c] py-24" id="how-it-works">
      <Container>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
          className="grid grid-cols-1 items-center gap-12 rounded-[2rem] border border-white/10 bg-[#0e1218] bg-gradient-to-br from-[rgba(230,185,92,0.05)] to-transparent p-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:p-12"
        >
          <motion.div variants={reveal}>
            <h2 className="mb-4 text-3xl font-bold leading-tight text-white lg:text-4xl">{t("how.heading")}</h2>
            <p className="text-lg leading-relaxed text-[#94a3b8]">{t("how.subtitle")}</p>
          </motion.div>

          <motion.div variants={cardStagger} className="grid gap-4">
            {steps.map((step, index) => (
              <motion.article
                key={step.id}
                variants={reveal}
                className="landing-interactive-card group flex gap-4 rounded-2xl border border-white/5 bg-white/[0.025] p-5"
              >
                <span className="text-lg font-bold text-[#0fc9a7] transition-colors group-hover:text-[#72ead4]">{step.id}</span>
                <div>
                  <h3 className="mb-1 text-lg font-bold text-white">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-[#94a3b8]">{step.description}</p>
                </div>
                <span className="ms-auto mt-2 hidden h-1.5 w-1.5 rounded-full bg-[#e6b95c]/60 sm:block" style={{ opacity: .55 + index * .2 }} aria-hidden="true" />
              </motion.article>
            ))}
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
