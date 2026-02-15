"use client";

import { Container } from "@/components/ui/container";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, Server } from "lucide-react";
import { fadeIn } from "@/lib/animations";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

export function Trust() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  return (
    <section className="py-20 bg-slate-50 border-t border-gray-100">
      <Container>
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            {t("trust.heading")}
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            {t("trust.subtitle")}
          </p>
        </div>

        {/* Logos Grid (Placeholders) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 opacity-60 mb-20 grayscale hover:grayscale-0 transition-all duration-500">
           {/* Simulate logos with text for now */}
           {["Salla", "Zid", "Shopify", "Mada"].map((name) => (
             <div key={name} className="h-16 flex items-center justify-center font-bold text-xl text-gray-400 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
               {name}
             </div>
           ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div 
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="flex flex-col items-center text-center p-6"
          >
            <div className="w-12 h-12 bg-isaudi-green/10 rounded-full flex items-center justify-center text-isaudi-green mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">{t("trust.card1.title")}</h3>
            <p className="text-sm text-gray-500">
              {t("trust.card1.body")}
            </p>
          </motion.div>

          <motion.div 
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center text-center p-6"
          >
            <div className="w-12 h-12 bg-isaudi-green/10 rounded-full flex items-center justify-center text-isaudi-green mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">{t("trust.card2.title")}</h3>
            <p className="text-sm text-gray-500">
              {t("trust.card2.body")}
            </p>
          </motion.div>

          <motion.div 
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center text-center p-6"
          >
            <div className="w-12 h-12 bg-isaudi-green/10 rounded-full flex items-center justify-center text-isaudi-green mb-4">
              <Server className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">{t("trust.card3.title")}</h3>
            <p className="text-sm text-gray-500">
              {t("trust.card3.body")}
            </p>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
