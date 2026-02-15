"use client";

import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowUpRight, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { slideUp, slideInRight } from "@/lib/animations";
import Image from "next/image";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

export function SampleReport() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  return (
    <section 
      className="py-20 overflow-hidden relative"
      style={{ 
        background: 'linear-gradient(to bottom, rgba(0,108,53,0.03), rgba(0,108,53,0.00))'
      }}
    >
      {/* Decorative Background Image */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-10 w-[60%] md:w-full md:max-w-[800px] h-[300px] md:h-[500px] pointer-events-none z-0 opacity-[0.1]">
         <Image 
           src="/images/chart.png" 
           alt={t("sample.alt.backgroundDecoration")} 
           fill
           className="object-contain"
         />
      </div>

      <Container className="relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          
          {/* Left Side - Text */}
          <div className="w-full lg:w-1/3 order-2 lg:order-1 text-right">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={slideUp}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                {t("sample.heading")} <br />
                <span className="text-isaudi-green">{t("sample.heading.highlight")}</span>
              </h2>
              <p className="text-gray-600 mb-8 leading-relaxed">
                {t("sample.subtitle")}
              </p>
              
              <div className="space-y-4 mb-8">
                {[
                  t("sample.point1"),
                  t("sample.point2"),
                  t("sample.point3"),
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 justify-end">
                    <span className="text-gray-700">{item}</span>
                    <CheckCircle2 className="w-5 h-5 text-isaudi-green shrink-0" />
                  </div>
                ))}
              </div>

              <Button className="w-full sm:w-auto">
                {t("sample.cta")}
              </Button>
            </motion.div>
          </div>

          {/* Right Side - Dashboard Mockup */}
          <motion.div 
            className="w-full lg:w-2/3 order-1 lg:order-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={slideInRight}
          >
            <div className="bg-white rounded-2xl shadow-2xl shadow-slate-200/50 border border-gray-100 p-6 md:p-8">
              {/* Dashboard Header */}
              <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100" />
                  <div>
                    <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-20 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="px-3 py-1 bg-green-50 text-green-700 text-sm rounded-full font-medium">
                  {t("sample.status.active")}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Stat 1 */}
                <div 
                  className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:-translate-y-[6px] transition-all duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.06)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500 text-sm">{t("sample.stat1.label")}</span>
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    42,500 
                    <div className="relative w-5 h-5 opacity-80">
                      <Image 
                        src="/icons/sar.svg" 
                        alt="SAR" 
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>
                  <div className="text-sm text-green-600 mt-1 flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" />
                    <span>12%</span>
                    <span className="text-gray-400 text-xs">
                      {t("sample.stat1.deltaLabel")}
                    </span>
                  </div>
                </div>
                 {/* Stat 2 */}
                 <div 
                   className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:-translate-y-[6px] transition-all duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
                   style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.06)' }}
                 >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500 text-sm">{t("sample.stat2.label")}</span>
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    185
                    <div className="relative w-5 h-5 opacity-80">
                      <Image 
                        src="/icons/sar.svg" 
                        alt="SAR" 
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>
                  <div className="text-sm text-green-600 mt-1 flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" />
                    <span>5.2%</span>
                  </div>
                </div>
                 {/* Stat 3 */}
                 <div 
                   className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:-translate-y-[6px] transition-all duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
                   style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.06)' }}
                 >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500 text-sm">{t("sample.stat3.label")}</span>
                    <div className="w-4 h-4 rounded-full bg-yellow-400" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">2.4%</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {t("sample.stat3.note")}
                  </div>
                </div>
              </div>

              {/* Actionable Insight */}
              <div className="bg-white rounded-xl p-6 border border-isaudi-green/10 relative overflow-hidden shadow-md">
                <div className="absolute top-0 right-0 w-1 h-full bg-isaudi-green" />
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-white rounded-lg shadow-sm text-isaudi-green">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-right">
                    <h4 className="font-bold text-gray-900 mb-1">
                      {t("sample.insight.title")}
                    </h4>
                    <p className="text-sm text-gray-600 mb-3">
                      {t("sample.insight.body")}
                    </p>
                    <Button size="sm" variant="outline" className="bg-white hover:bg-gray-50 text-isaudi-green border-isaudi-green/20">
                      {t("sample.insight.cta")}
                    </Button>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
