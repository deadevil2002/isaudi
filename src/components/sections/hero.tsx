"use client";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, PlayCircle } from "lucide-react";
import { fadeIn, slideUp, slideInRight, slideInLeft, staggerContainer } from "@/lib/animations";
import { AiInsight } from "@/components/illustrations/ai-insight";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

export function Hero() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-gradient-to-b from-slate-50 to-white">
      {/* Background Elements */}
      <div className="absolute top-0 right-0 -z-10 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-isaudi-green/5 via-transparent to-transparent opacity-70" />
      <div className="absolute bottom-0 left-0 -z-10 w-1/3 h-1/3 bg-slate-200/20 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />

      <Container>
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          
          {/* Right Side - Content (Arabic) */}
          <motion.div 
            className="w-full lg:w-1/2 text-right order-2 lg:order-1"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* Hero Logo */}
            <motion.div variants={slideUp} className="mb-8 flex justify-end">
              <div className="relative w-32 h-32 md:w-40 md:h-40">
                <Image 
                  src="/logo.png" 
                  alt="isaudi.ai Logo" 
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </motion.div>

            <motion.div variants={slideUp} className="inline-block mb-4 px-3 py-1 bg-isaudi-green/10 text-isaudi-green rounded-full text-sm font-medium border border-isaudi-green/20">
              {t("hero.badge")}
            </motion.div>
            
            <motion.h1 
              variants={slideUp}
              className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-gray-900 mb-6"
            >
              {t("hero.title.main")}{" "}
              <span className="text-isaudi-green">
                {t("hero.title.highlight")}
              </span>{" "}
              {t("hero.title.suffix")}
            </motion.h1>
            
            <motion.p 
              variants={slideUp}
              className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed max-w-2xl ml-auto"
            >
              {t("hero.subtitle")}
            </motion.p>
            
            <motion.div 
              variants={slideUp}
              className="flex flex-wrap gap-4 justify-end"
            >
              <Link href="#how-it-works">
                <Button size="lg" variant="outline" className="gap-2 group">
                  <PlayCircle className="w-5 h-5 group-hover:text-isaudi-green transition-colors" />
                  {t("hero.cta.how")}
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" className="gap-2 shadow-lg shadow-isaudi-green/20 hover:shadow-isaudi-green/30">
                  <ArrowLeft className="w-5 h-5" />
                  {t("hero.cta.freeReport")}
                </Button>
              </Link>
            </motion.div>

            <motion.p 
              variants={slideUp} 
              className="text-xs text-gray-400 mt-4 max-w-lg ml-auto leading-relaxed"
            >
              {t("hero.disclaimer")}
            </motion.p>
            
            <motion.div variants={slideUp} className="mt-8 flex items-center justify-end gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {t("hero.badge.fast")}
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {t("hero.badge.security")}
              </span>
            </motion.div>
          </motion.div>

          {/* Left Side - Animated Mockup */}
          <motion.div 
            className="w-full lg:w-1/2 order-1 lg:order-2"
            initial="hidden"
            animate="visible"
            variants={slideInLeft}
          >
            <div className="relative mx-auto max-w-[500px] lg:max-w-full perspective-1000">
              {/* Layered Back Panels */}
              <div className="absolute top-4 -right-4 w-full h-full bg-white rounded-2xl shadow-xl border border-gray-100 -z-10 opacity-60 scale-[0.98]" />
              <div className="absolute top-8 -right-8 w-full h-full bg-white rounded-2xl shadow-lg border border-gray-100 -z-20 opacity-30 scale-[0.96]" />

              {/* Main Card */}
              <motion.div 
                className="relative bg-white rounded-2xl shadow-2xl shadow-slate-200/50 border border-gray-100 p-6 z-10 backdrop-blur-sm bg-white/90 overflow-hidden"
                initial={{ rotateY: -10, rotateX: 5 }}
                animate={{ rotateY: 0, rotateX: 0 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              >
                {/* Decorative Dot Pattern */}
                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                   <div className="grid grid-cols-6 gap-2">
                      {[...Array(24)].map((_, i) => (
                        <div key={i} className="w-1 h-1 rounded-full bg-gray-900" />
                      ))}
                   </div>
                </div>

                {/* Header of Mockup */}
                <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="relative w-20 h-6 opacity-80">
                    <Image 
                        src="/logo.png" 
                        alt="isaudi.ai" 
                        fill
                        className="object-contain"
                    />
                  </div>
                </div>
                
                {/* Content of Mockup */}
                <div className="space-y-6">
                  {/* Sales Chart Section */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="space-y-1">
                      <div className="text-sm text-gray-400 font-medium">
                        {t("hero.mock.totalSales")}
                      </div>
                      <div className="h-8 w-32 bg-isaudi-green/5 rounded text-isaudi-green flex items-center justify-center font-bold text-lg px-2 border border-isaudi-green/10">
                        +12.5% 🚀
                      </div>
                    </div>
                  </div>
                  
                  {/* Chart Image */}
                  <div className="relative w-full h-48 md:h-56 bg-slate-50 rounded-xl border border-gray-100 overflow-hidden p-2">
                    <Image 
                      src="/images/chart2.png" 
                      alt="Sales Analysis" 
                      fill
                      className="object-contain"
                    />
                  </div>

                  {/* AI Insight Section */}
                  <div className="pt-2">
                     <AiInsight className="w-full h-auto drop-shadow-sm" />
                  </div>
                </div>
              </motion.div>

              {/* Floating Elements */}
              <motion.div 
                className="absolute -top-6 -right-6 bg-white p-4 rounded-xl shadow-xl border border-gray-100 z-20"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.8 }}
              >
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
                     <div className="relative w-6 h-6 opacity-80">
                        <Image 
                           src="/icons/sar.svg" 
                           alt="SAR" 
                           fill
                           className="object-contain"
                        />
                     </div>
                   </div>
                   <div>
                    <div className="text-xs text-gray-500">
                      {t("hero.mock.expectedProfit")}
                    </div>
                     <div className="font-bold text-gray-900 flex items-center gap-1">
                        24,500 
                        <span className="text-sm font-normal">
                          {t("hero.mock.currencySar")}
                        </span>
                     </div>
                   </div>
                </div>
              </motion.div>
              
              <motion.div 
                className="absolute -bottom-8 -left-4 bg-white p-4 rounded-xl shadow-xl border border-gray-100 z-20 min-w-[200px]"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.8 }}
              >
                 <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-gray-800">
                      {t("hero.mock.competitorAnalysis")}
                    </span>
                 </div>
                 <div className="relative h-32 w-full bg-slate-50 rounded-lg overflow-hidden border border-slate-100 p-2 flex items-center justify-center">
                     <Image 
                       src="/images/chart.png" 
                       alt={t("hero.mock.competitorAnalysis")} 
                       width={800} 
                       height={500} 
                       className="w-full h-auto object-contain" 
                     />
                 </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}

const staggerChildren = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};
