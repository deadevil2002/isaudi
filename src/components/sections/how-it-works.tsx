"use client";

import { Container } from "@/components/ui/container";
import { motion } from "framer-motion";
import { Database, LineChart, FileText } from "lucide-react";
import { fadeIn, staggerContainer } from "@/lib/animations";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

export function HowItWorks() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  const steps = [
    {
      id: 1,
      title: t("how.step1.title"),
      description: t("how.step1.description"),
      icon: Database,
    },
    {
      id: 2,
      title: t("how.step2.title"),
      description: t("how.step2.description"),
      icon: LineChart,
    },
    {
      id: 3,
      title: t("how.step3.title"),
      description: t("how.step3.description"),
      icon: FileText,
    },
  ];

  return (
    <section className="py-20 bg-white" id="how-it-works">
      <Container>
        <div className="text-center mb-16">
          <motion.h2 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
          >
            {t("how.heading")}
          </motion.h2>
          <motion.p 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-gray-600 max-w-2xl mx-auto"
          >
            {t("how.subtitle")}
          </motion.p>
        </div>

        <motion.div 
          className="relative grid grid-cols-1 md:grid-cols-3 gap-8"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {/* Connector Line (Desktop only) */}
          <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gray-100 -z-10">
            <motion.div 
              className="h-full bg-isaudi-green origin-right"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
          </div>

          {steps.map((step, index) => (
            <motion.div 
              key={step.id}
              variants={fadeIn}
              className="relative flex flex-col items-center text-center group"
            >
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center shadow-sm group-hover:border-isaudi-green transition-colors duration-300">
                  <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-isaudi-green/5 transition-colors duration-300">
                    <step.icon className="w-8 h-8 text-gray-400 group-hover:text-isaudi-green transition-colors duration-300" />
                  </div>
                </div>
                <div className="absolute top-0 right-0 -mr-2 -mt-2 w-8 h-8 rounded-full bg-isaudi-green text-white flex items-center justify-center font-bold text-sm border-4 border-white">
                  {step.id}
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
              <p className="text-gray-500 leading-relaxed px-4">
                {step.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
