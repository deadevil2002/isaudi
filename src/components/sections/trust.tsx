"use client";

import { Container } from "@/components/ui/container";
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, Lock, Server } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

export function Trust() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const reduceMotion = useReducedMotion();

  return (
    <section className="py-24 bg-[#06090c]">
      <Container>
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            {t("trust.heading")}
          </h2>
          <p className="text-[#94a3b8] max-w-2xl mx-auto">
            {t("trust.subtitle")}
          </p>
        </div>

        {/* Logos Grid (Placeholders) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 opacity-80 mb-20">
           {/* Simulate logos with text for now */}
           {["Salla", "Zid", "Shopify", "Mada"].map((name) => (
             <div key={name} className="h-16 flex items-center justify-center font-bold text-xl text-[#94a3b8] bg-[#0e1218] rounded-xl border border-white/10 hover:border-[#e6b95c]/50 hover:text-white transition-all duration-300">
               {name}
             </div>
           ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div 
            initial={false}
            whileInView={reduceMotion ? undefined : { opacity: [0, 1], y: [20, 0] }}
            viewport={{ once: true }}
            className="flex flex-col items-center text-center p-8 bg-[#161c24] border border-white/5 rounded-2xl"
          >
            <div className="w-14 h-14 bg-[#0fc9a7]/10 rounded-full flex items-center justify-center text-[#0fc9a7] mb-6">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white mb-3 text-lg">{t("trust.card1.title")}</h3>
            <p className="text-sm text-[#94a3b8] leading-relaxed">
              {t("trust.card1.body")}
            </p>
          </motion.div>

          <motion.div 
            initial={false}
            whileInView={reduceMotion ? undefined : { opacity: [0, 1], y: [20, 0] }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center text-center p-8 bg-[#161c24] border border-white/5 rounded-2xl"
          >
            <div className="w-14 h-14 bg-[#e6b95c]/10 rounded-full flex items-center justify-center text-[#e6b95c] mb-6">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white mb-3 text-lg">{t("trust.card2.title")}</h3>
            <p className="text-sm text-[#94a3b8] leading-relaxed">
              {t("trust.card2.body")}
            </p>
          </motion.div>

          <motion.div 
            initial={false}
            whileInView={reduceMotion ? undefined : { opacity: [0, 1], y: [20, 0] }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center text-center p-8 bg-[#161c24] border border-white/5 rounded-2xl"
          >
            <div className="w-14 h-14 bg-[#0a997e]/10 rounded-full flex items-center justify-center text-[#0a997e] mb-6">
              <Server className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white mb-3 text-lg">{t("trust.card3.title")}</h3>
            <p className="text-sm text-[#94a3b8] leading-relaxed">
              {t("trust.card3.body")}
            </p>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
