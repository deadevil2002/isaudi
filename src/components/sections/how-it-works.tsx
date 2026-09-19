"use client";

import { Container } from "@/components/ui/container";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

export function HowItWorks() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const reduceMotion = useReducedMotion();

  const steps = [
    {
      id: "01",
      title: t("how.step1.title"),
      description: t("how.step1.description"),
    },
    {
      id: "02",
      title: t("how.step2.title"),
      description: t("how.step2.description"),
    },
    {
      id: "03",
      title: t("how.step3.title"),
      description: t("how.step3.description"),
    },
  ];

  return (
    <section className="py-24 bg-[#06090c]" id="how-it-works">
      <Container>
        <motion.div 
          initial={false}
          whileInView={reduceMotion ? undefined : { opacity: [0.94, 1], y: [14, 0] }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.45 }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] items-center gap-12 lg:gap-20 p-8 lg:p-12 border border-white/10 rounded-[2rem] bg-gradient-to-br from-[rgba(230,185,92,0.05)] to-transparent bg-[#0e1218]">

            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4 leading-tight">
                {t("how.heading")}
              </h2>
              <p className="text-[#94a3b8] text-lg leading-relaxed">
                {t("how.subtitle")}
              </p>
            </div>

            <div className="grid gap-4">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="flex gap-4 p-5 border border-white/5 rounded-2xl bg-white/[0.025]"
                >
                  <span className="text-[#0fc9a7] font-bold text-lg">{step.id}</span>
                  <div>
                    <h3 className="text-white font-bold mb-1 text-lg">{step.title}</h3>
                    <p className="text-[#94a3b8] text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </motion.div>
      </Container>
    </section>
  );
}
