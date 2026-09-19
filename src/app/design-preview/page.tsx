"use client";

import React from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  Bot,
  ChevronLeft,
  LineChart,
  Menu,
  MessageSquare,
  PieChart,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  User,
  X,
  CheckCircle2,
  Lock,
  Globe,
  Video
} from "lucide-react";
import styles from "./preview.module.css";

// Reusable animated section wrapper
const FadeIn = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
  <FadeInMotion delay={delay}>{children}</FadeInMotion>
);

function FadeInMotion({ children, delay }: { children: React.ReactNode; delay: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={false}
      whileInView={reduceMotion ? undefined : { opacity: [0.94, 1], y: [14, 0] }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.45, delay }}
    >
      {children}
    </motion.div>
  );
}

function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`${styles.brandLogo} ${className}`}>
      <Image
        src="/brand/design-preview-logo.png"
        alt="iSaudi.ai"
        width={1448}
        height={1086}
      />
    </span>
  );
}

export default function DesignPreview() {
  const reduceMotion = useReducedMotion();

  const previewLinks = [
    ["الرئيسية", "#preview-home"],
    ["الحلول", "#preview-solutions"],
    ["لوحة التحكم", "#preview-dashboard"],
    ["الأسعار", "#preview-pricing"],
  ] as const;

  return (
    <div className={styles.previewWrapper}>
      {/* Navigation */}
      <nav className={styles.nav} aria-label="التنقل داخل معاينة التصميم">
        <div className={styles.navInner}>
          <BrandLogo className={styles.brandLogoNav} />
          
          <div className={styles.navLinks}>
            {previewLinks.map(([label, href]) => (
              <a key={href} className={styles.navLink} href={href}>{label}</a>
            ))}
          </div>

          <div className={styles.navActions}>
            <a className={`${styles.btnSecondary} hidden md:block`} href="#preview-login">تسجيل الدخول</a>
            <a className={`${styles.btnPrimary} hidden md:block`} href="#preview-pricing">استعرض الخطط</a>
            <div className={styles.mobileMenu}>
              <a href="#preview-mobile-menu" aria-label="فتح قائمة المعاينة"><Menu /></a>
              <div className={styles.mobileMenuPanel} id="preview-mobile-menu">
                <div className="flex justify-between items-center mb-8">
                  <BrandLogo className={styles.brandLogoNav} />
                  <a className={styles.iconButton} href="#preview-home" aria-label="إغلاق قائمة المعاينة"><X size={20} /></a>
                </div>
                <div className="flex flex-col gap-6 text-xl">
                  {previewLinks.map(([label, href]) => (
                    <a key={href} className={styles.navLink} href={href}>{label}</a>
                  ))}
                </div>
                <div className="mt-auto flex flex-col gap-4">
                  <a className={styles.btnSecondary} href="#preview-login">تسجيل الدخول</a>
                  <a className={styles.btnPrimary} href="#preview-pricing">استعرض الخطط</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <section id="preview-login" className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="preview-login-title">
        <div className={styles.loginModal}>
          <input className={styles.stepControl} type="radio" name="preview-auth-step" id="preview-auth-email" value="email" defaultChecked />
          <input className={styles.stepControl} type="radio" name="preview-auth-step" id="preview-auth-otp" value="otp" />
          <input className={styles.stepControl} type="radio" name="preview-auth-step" id="preview-auth-verified" value="verified" />
          <div className="flex items-center justify-between mb-8">
            <div>
              <BrandLogo className={styles.brandLogoModal} />
              <span className={styles.modalEyebrow}>تجربة آمنة للمعاينة</span>
              <h2 id="preview-login-title" className="text-2xl font-bold mt-2">تسجيل الدخول برمز التحقق</h2>
            </div>
            <a className={styles.iconButton} href="#preview-account" aria-label="إغلاق معاينة تسجيل الدخول"><X size={20} /></a>
          </div>
          <div className={`${styles.authStep} ${styles.emailStep}`}>
            <div>
              <label className={styles.label} htmlFor="preview-modal-email">البريد الإلكتروني</label>
              <input id="preview-modal-email" type="email" placeholder="name@company.com" className={styles.input} />
            </div>
            <label className={`${styles.btnPrimary} ${styles.actionLabel}`} htmlFor="preview-auth-otp">إرسال رمز التحقق</label>
          </div>
          <div className={`${styles.authStep} ${styles.otpStep}`}>
            <p className="text-sm text-[#94a3b8] leading-relaxed">أدخل الرمز التجريبي المكوّن من 6 أرقام. لن يتم إرسال بريد أو الاتصال بخدمة المصادقة.</p>
            <div>
              <label className={styles.label} htmlFor="preview-modal-otp">رمز التحقق</label>
              <input id="preview-modal-otp" inputMode="numeric" maxLength={6} placeholder="••••••" className={`${styles.input} ${styles.otpInput}`} />
            </div>
            <label className={`${styles.btnPrimary} ${styles.actionLabel}`} htmlFor="preview-auth-verified">تحقق تجريبياً</label>
            <label className={`${styles.btnSecondary} ${styles.actionLabel}`} htmlFor="preview-auth-email">تعديل البريد</label>
          </div>
          <div className={`${styles.authStep} ${styles.verifiedStep} text-center`}>
            <div className={styles.successIcon}><CheckCircle2 size={32} /></div>
            <h3 className="text-xl font-bold mb-2">اكتملت المعاينة</h3>
            <p className="text-sm text-[#94a3b8] mb-6">هذه حالة نجاح بصرية فقط، ولم يتم إنشاء جلسة أو حفظ أي بيانات.</p>
            <a className={`${styles.btnPrimary} block w-full`} href="#preview-account">العودة إلى المعاينة</a>
          </div>
          <p className="text-xs text-[#64748b] text-center mt-6">لا توجد أي مكالمات API في هذه التجربة.</p>
        </div>
      </section>

      <main className={styles.container}>
        {/* 1. Hero / Homepage */}
        <section className={styles.hero} id="preview-home">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={false}
              animate={reduceMotion ? undefined : { opacity: [0.92, 1], y: [8, 0] }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <BrandLogo className={styles.brandLogoHero} />
              <div className={styles.previewNotice}>
                معاينة تصميم معزولة — لا تنفذ عمليات حقيقية
              </div>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#161c24] border border-[#ffffff1a] text-sm text-[#94a3b8] mb-8">
                <Sparkles size={16} className={styles.textGold} />
                مستقبل أعمال السعودية يبدأ الآن
              </span>
              <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                الذكاء الاصطناعي، <br />
                <span className={styles.textGold}>بلغة السعودية</span>
              </h1>
              <p className="text-lg md:text-xl text-[#94a3b8] mb-10 max-w-2xl mx-auto leading-relaxed">
                منصة تساعدك على فهم المبيعات والتكاليف والأرباح من خلال تقارير واضحة
                ومساعد ذكي مرتبط بسياق تقاريرك.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <a href="#preview-dashboard" className={`${styles.btnPrimary} text-lg px-8 py-4`}>
                  استعرض التجربة
                </a>
                <a href="#preview-solutions" className={`${styles.btnSecondary} text-lg px-8 py-4 flex items-center justify-center gap-2`}>
                  <Globe size={20} />
                  استكشف الحلول
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.valueSection}`} id="preview-value">
          <FadeIn>
            <div className={styles.valueGrid}>
              <div>
                <span className={styles.kicker}>من البيانات إلى قرار أوضح</span>
                <h2 className={styles.sectionTitle}>افهم أداء متجرك دون تعقيد</h2>
                <p className={styles.sectionSubtitle}>
                  اجمع ملفات المنتجات والطلبات، أضف التكاليف، ثم راجع ملخصات المبيعات والأرباح والهامش وتقارير المقارنة الأسبوعية.
                </p>
              </div>
              <div className={styles.valueSteps}>
                {[
                  ["01", "ارفع بياناتك", "ملفات CSV للمنتجات والطلبات."],
                  ["02", "راجع التقرير", "ملخصات واضحة للمبيعات والتكاليف والأرباح."],
                  ["03", "اسأل المساعد", "أسئلة مرتبطة بسياق التقرير المفتوح."],
                ].map(([number, title, description]) => (
                  <div className={styles.valueStep} key={number}>
                    <span>{number}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </section>

        {/* 2. Solutions / Features */}
        <section className={styles.section} id="preview-solutions">
          <FadeIn>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>حلولنا</h2>
              <p className={styles.sectionSubtitle}>
                تقنيات متقدمة لتمكين أعمالك في كل مرحلة من رحلتك
              </p>
            </div>
          </FadeIn>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FadeIn delay={0.1}>
              <div className={styles.card}>
                <div className="w-12 h-12 rounded-lg bg-[#0a997e]/20 flex items-center justify-center mb-6">
                  <Bot className={styles.textTeal} size={24} />
                </div>
                <h3 className="text-2xl font-bold mb-4">مساعد الأعمال الذكي</h3>
                <p className="text-[#94a3b8] mb-6 line-clamp-3">
                  مساعد مرتبط بسياق التقرير يجيب عن أسئلتك ويساعدك على فهم الأرقام والتوصيات.
                </p>
                <a href="#preview-assistant" className="text-[#0fc9a7] flex items-center gap-2 font-medium">
                  شاهد المعاينة <ChevronLeft size={16} />
                </a>
              </div>
            </FadeIn>
            
            <FadeIn delay={0.2}>
              <div className={styles.card}>
                <div className="w-12 h-12 rounded-lg bg-[#e6b95c]/20 flex items-center justify-center mb-6">
                  <LineChart className={styles.textGold} size={24} />
                </div>
                <h3 className="text-2xl font-bold mb-4">تحليل البيانات الفوري</h3>
                <p className="text-[#94a3b8] mb-6 line-clamp-3">
                  حوّل بياناتك إلى رؤى قابلة للتنفيذ في ثوانٍ معدودة. استخرج المعلومات بدقة عالية.
                </p>
                <a href="#preview-dashboard" className="text-[#e6b95c] flex items-center gap-2 font-medium">
                  شاهد التقارير <ChevronLeft size={16} />
                </a>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* 3. Dashboard Shell */}
        <section className={styles.section} id="preview-dashboard">
          <FadeIn>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>لوحة تحكم ذكية</h2>
              <p className={styles.sectionSubtitle}>
                كل ما تحتاجه لإدارة متجرك في مكان واحد
              </p>
              <span className={styles.sampleBadge}>بيانات توضيحية للمعاينة وليست بيانات متجر حقيقية</span>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className={styles.dashboardGrid}>
              {/* Sidebar */}
              <aside className={`${styles.sidebar} hidden lg:flex`}>
                <BrandLogo className={styles.brandLogoDashboard} />
                <a className={`${styles.sidebarItem} ${styles.active}`} href="#preview-dashboard">
                  <PieChart size={20} />
                  <span>نظرة عامة</span>
                </a>
                <a className={styles.sidebarItem} href="#preview-reports">
                  <LineChart size={20} />
                  <span>التقارير</span>
                </a>
                <a className={styles.sidebarItem} href="#preview-dashboard">
                  <Store size={20} />
                  <span>المبيعات</span>
                </a>
                <a className={styles.sidebarItem} href="#preview-assistant">
                  <MessageSquare size={20} />
                  <span>المساعد الذكي</span>
                </a>
                <div className="mt-auto">
                  <a className={`${styles.sidebarItem} w-full`} href="#preview-account">
                    <Settings size={20} />
                    <span>الإعدادات</span>
                  </a>
                </div>
              </aside>

              {/* Main Content */}
              <div className="space-y-6">
                <div className="flex gap-4 border-b border-[#ffffff1a] pb-4 overflow-x-auto lg:hidden">
                  <a href="#preview-dashboard" className="px-4 py-2 rounded-full whitespace-nowrap bg-[#0fc9a7]/10 text-[#0fc9a7]">نظرة عامة</a>
                  <a href="#preview-reports" className="px-4 py-2 rounded-full whitespace-nowrap text-[#94a3b8]">التقارير</a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>إجمالي المبيعات</div>
                    <div className={styles.statValue}>124,500 <span className="text-sm text-[#94a3b8]">SAR</span></div>
                    <div className={`${styles.statChange} ${styles.positive}`}>
                      <TrendingUp size={16} /> 12.5% من الشهر الماضي
                    </div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>الأرباح المتوقعة</div>
                    <div className={styles.statValue}>32,100 <span className="text-sm text-[#94a3b8]">SAR</span></div>
                    <div className={`${styles.statChange} ${styles.positive}`}>
                      <TrendingUp size={16} /> 8.2% من الشهر الماضي
                    </div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>عدد الطلبات</div>
                    <div className={styles.statValue}>342</div>
                    <div className={`${styles.statChange} ${styles.negative}`}>
                      <TrendingUp size={16} className="rotate-180" /> 1.1% من الفترة السابقة
                    </div>
                  </div>
                </div>

                {/* Reports & Market Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="preview-reports">
                  <div className={`${styles.card} p-0`}>
                    <div className="p-6 border-b border-[#ffffff1a] flex justify-between items-center">
                      <h3 className="font-bold text-lg">أداء المبيعات الأسبوعي</h3>
                    </div>
                    <div className={styles.chartContainer}>
                      {[40, 60, 45, 80, 50, 90, 70].map((h, i) => (
                        <div key={i} className={styles.chartBar} style={{ height: `${h}%` }}></div>
                      ))}
                    </div>
                    <div className="flex justify-between px-6 pb-6 text-sm text-[#64748b]">
                      <span>السبت</span>
                      <span>الأحد</span>
                      <span>الاثنين</span>
                      <span>الثلاثاء</span>
                      <span>الأربعاء</span>
                      <span>الخميس</span>
                      <span>الجمعة</span>
                    </div>
                  </div>

                  <div className={styles.cardElevated + " rounded-3xl p-6 border border-[#ffffff1a]"}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-[#0fc9a7]/10 flex items-center justify-center">
                        <BarChart3 className={styles.textTeal} size={20} />
                      </div>
                      <h3 className="font-bold text-lg">مقارنة السوق</h3>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-[#94a3b8]">متوسط السلة الشرائية</span>
                          <span className="font-bold text-[#0fc9a7]">+15% أعلى من السوق</span>
                        </div>
                        <div className="h-2 w-full bg-[#161c24] rounded-full overflow-hidden flex">
                          <div className="h-full bg-[#0fc9a7] w-[65%]"></div>
                          <div className="h-full bg-[#334155] w-[35%] border-l-2 border-[#161c24]"></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-[#94a3b8]">سعر منتج نموذجي</span>
                          <span className="font-bold text-[#e6b95c]">مقارنة توضيحية</span>
                        </div>
                        <div className="h-2 w-full bg-[#161c24] rounded-full overflow-hidden flex">
                          <div className="h-full bg-[#e6b95c] w-[45%]"></div>
                          <div className="h-full bg-[#334155] w-[55%] border-l-2 border-[#161c24]"></div>
                        </div>
                      </div>

                      <div className="p-4 bg-[#161c24] rounded-xl border border-[#ffffff1a]">
                        <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                          <Sparkles size={16} className={styles.textGold} />
                          توصية ذكية
                        </h4>
                        <p className="text-sm text-[#94a3b8] leading-relaxed">
                           مثال توضيحي: راجع سعر المنتج مقارنةً بمتوسط السوق قبل اتخاذ قرار التسعير.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* 4. AI Assistant */}
        <section className={styles.section} id="preview-assistant">
          <FadeIn>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>مساعدك الشخصي</h2>
              <p className={styles.sectionSubtitle}>
                تحدث مع بياناتك مباشرة واحصل على إجابات دقيقة
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="max-w-3xl mx-auto bg-[#0e1218] border border-[#ffffff1a] rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-[#ffffff1a] flex items-center gap-3 bg-[#161c24]">
                <BrandLogo className={styles.brandLogoAssistant} />
                <div>
                  <h3 className="font-bold">مساعد isaudi.ai</h3>
                  <span className="text-xs text-[#10b981] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
                    وضع المعاينة
                  </span>
                </div>
              </div>
              
              <div className="p-6 h-[400px] overflow-y-auto">
                <div className={`${styles.chatMessage} ai`}>
                  <div className={`${styles.chatAvatar} ${styles.ai}`}>
                    <Bot size={20} />
                  </div>
                  <div className={styles.chatContent}>
                    مرحباً، كيف يمكنني مساعدتك في فهم هذا التقرير؟
                  </div>
                </div>
                
                <div className={`${styles.chatMessage} user`}>
                  <div className={styles.chatAvatar}>
                    <User size={20} />
                  </div>
                  <div className={styles.chatContent}>
                    أريد معرفة أكثر المنتجات مبيعاً هذا الأسبوع ولماذا؟
                  </div>
                </div>
                
                <div className={`${styles.chatMessage} ai`}>
                  <div className={`${styles.chatAvatar} ${styles.ai}`}>
                    <Bot size={20} />
                  </div>
                  <div className={styles.chatContent}>
                    <p className="mb-2">بحسب البيانات التوضيحية في هذا التقرير، يظهر منتج نموذجي كالأعلى مبيعاً خلال الأسبوع.</p>
                    <p className="mb-2">يمكن للمساعد أن يوضح لك:</p>
                    <ul className="list-disc list-inside text-sm text-[#94a3b8] mr-4 space-y-1">
                      <li>التغيّر في المبيعات والطلبات مقارنةً بالفترة السابقة.</li>
                      <li>أثر التكاليف المسجلة على الربح والهامش.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-[#ffffff1a] bg-[#161c24]">
                <div className="relative">
                  <input
                    type="text" 
                    placeholder="اكتب سؤالاً تجريبياً"
                    className="w-full bg-[#0e1218] border border-[#ffffff1a] rounded-full py-3 pr-4 pl-12 text-white outline-none focus:border-[#0fc9a7] transition-colors"
                    aria-label="سؤال تجريبي غير مرسل"
                  />
                  <a
                    href="#preview-assistant-response"
                    aria-label="عرض حالة الإرسال التوضيحية"
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#0fc9a7] flex items-center justify-center text-black"
                  >
                    <ChevronLeft size={18} />
                  </a>
                </div>
                <p id="preview-assistant-response" className={styles.assistantStatus} role="status">
                  تم عرض التفاعل محلياً فقط — لا يتم إرسال السؤال أو حفظه.
                </p>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* 5. TikTok Concept */}
        <section className={styles.section} id="preview-tiktok">
          <FadeIn>
            <div className={styles.tiktokConcept}>
              <div className={styles.tiktokContent}>
                <span className={styles.comingSoonBadge}>قريباً</span>
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-black to-gray-800 flex items-center justify-center border border-white/20 shadow-2xl">
                    <Video className="text-white" size={32} />
                  </div>
                </div>
                <h2 className={styles.sectionTitle}>تصور بصري لتحليل تيك توك</h2>
                <p className={styles.sectionSubtitle}>
                  هذه مساحة تصميم استكشافية فقط. تكامل تيك توك وتحليلاته غير متاحة حالياً في المنتج، ولا تمثل التزاماً بإطلاق ميزة مستقبلية.
                </p>
                
                <div className="mt-10 flex flex-wrap justify-center gap-4">
                  <div className="bg-black/50 backdrop-blur border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <TrendingUp className="text-[#00f2fe]" />
                    <div className="text-right">
                      <div className="text-sm text-gray-400">تحليل المشاهدات</div>
                      <div className="font-bold">غير متاح</div>
                    </div>
                  </div>
                  <div className="bg-black/50 backdrop-blur border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <PieChart className="text-[#ff0050]" />
                    <div className="text-right">
                      <div className="text-sm text-gray-400">ربط الأداء بالمبيعات</div>
                      <div className="font-bold">غير متاح</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* 6. Pricing */}
        <section className={`${styles.section} ${styles.pricingSection}`} id="preview-pricing">
          <FadeIn>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>خطط تناسب كل حجم أعمال</h2>
              <p className={styles.sectionSubtitle}>
                اختر الخطة التي تناسب احتياجاتك، وابدأ رحلتك مع الذكاء الاصطناعي اليوم
              </p>
              
              <div className="flex justify-center mt-8">
                <fieldset className={styles.billingToggle} aria-label="دورة الفوترة">
                  <label className={styles.billingOption}>
                    <input
                      type="radio"
                      name="preview-billing"
                      value="yearly"
                    />
                    سنوي (وفر 16%)
                  </label>
                  <label className={styles.billingOption}>
                    <input
                      type="radio"
                      name="preview-billing"
                      value="monthly"
                      defaultChecked
                    />
                    شهري
                  </label>
                </fieldset>
              </div>
            </div>
          </FadeIn>

          <div className={styles.pricingGrid}>
            {/* Starter */}
            <FadeIn delay={0.1}>
              <div className={styles.pricingCard}>
                <h3 className="text-xl font-bold mb-2">البداية (Starter)</h3>
                <p className="text-[#94a3b8] text-sm">للمتاجر الناشئة</p>
                <div className={styles.pricingPrice} aria-live="polite">
                  <span className={styles.monthlyPrice}>199 <span className={styles.pricingCurrency}>ريال / الشهر</span></span>
                  <span className={styles.yearlyPrice}>1,999 <span className={styles.pricingCurrency}>ريال / السنة</span></span>
                </div>
                <div className={styles.pricingFeatures}>
                  <div className={styles.featureItem}>
                    <CheckCircle2 className={styles.featureIcon} size={18} />
                    <span>متجر واحد</span>
                  </div>
                  <div className={styles.featureItem}>
                    <CheckCircle2 className={styles.featureIcon} size={18} />
                    <span>30 تقريراً شهرياً</span>
                  </div>
                  <div className={styles.featureItem}>
                    <CheckCircle2 className={styles.featureIcon} size={18} />
                    <span>رفع CSV للمنتجات والطلبات</span>
                  </div>
                  <div className={styles.featureItem}>
                    <CheckCircle2 className={styles.featureIcon} size={18} />
                    <span>مساعد ذكي (إرشادي)</span>
                  </div>
                </div>
                 <a className={`${styles.btnSecondary} mt-8 w-full text-center`} href="#preview-login">متابعة المعاينة</a>
              </div>
            </FadeIn>

            {/* Growth */}
            <FadeIn delay={0.2}>
              <div className={`${styles.pricingCard} ${styles.popular}`}>
                <div className={styles.popularBadge}>الأكثر شيوعاً</div>
                <h3 className="text-xl font-bold mb-2 text-[#e6b95c]">النمو (Growth)</h3>
                <p className="text-[#94a3b8] text-sm">للمتاجر الطموحة</p>
                <div className={styles.pricingPrice} aria-live="polite">
                  <span className={styles.monthlyPrice}>399 <span className={styles.pricingCurrency}>ريال / الشهر</span></span>
                  <span className={styles.yearlyPrice}>3,999 <span className={styles.pricingCurrency}>ريال / السنة</span></span>
                </div>
                <div className={styles.pricingFeatures}>
                  <div className={styles.featureItem}>
                    <CheckCircle2 className={styles.featureIcon} size={18} />
                    <span>حتى 3 متاجر</span>
                  </div>
                  <div className={styles.featureItem}>
                    <CheckCircle2 className={styles.featureIcon} size={18} />
                    <span>200 تقرير شهرياً</span>
                  </div>
                  <div className={styles.featureItem}>
                    <CheckCircle2 className={styles.featureIcon} size={18} />
                    <span>مساعد ذكي مرتبط بالتقارير</span>
                  </div>
                  <div className={styles.featureItem}>
                    <CheckCircle2 className={styles.featureIcon} size={18} />
                    <span>مقارنة التقارير والفترات</span>
                  </div>
                </div>
                <a className={`${styles.btnPrimary} mt-8 w-full text-center`} href="#preview-login">متابعة المعاينة</a>
              </div>
            </FadeIn>

            {/* Business */}
            <FadeIn delay={0.3}>
              <div className={styles.pricingCard}>
                <h3 className="text-xl font-bold mb-2">المؤسسات (Business)</h3>
                <p className="text-[#94a3b8] text-sm">للشركات الكبرى</p>
                <div className={styles.pricingPrice} aria-live="polite">
                  <span className={styles.monthlyPrice}>899 <span className={styles.pricingCurrency}>ريال / الشهر</span></span>
                  <span className={styles.yearlyPrice}>8,999 <span className={styles.pricingCurrency}>ريال / السنة</span></span>
                </div>
                <div className={styles.pricingFeatures}>
                  <div className={styles.featureItem}>
                    <CheckCircle2 className={styles.featureIcon} size={18} />
                    <span>حتى 10 متاجر</span>
                  </div>
                  <div className={styles.featureItem}>
                    <CheckCircle2 className={styles.featureIcon} size={18} />
                    <span>تقارير شهرية غير محدودة</span>
                  </div>
                  <div className={styles.featureItem}>
                    <CheckCircle2 className={styles.featureIcon} size={18} />
                    <span>مساعد ذكي مرتبط بالتقارير</span>
                  </div>
                  <div className={styles.featureItem}>
                    <CheckCircle2 className={styles.featureIcon} size={18} />
                    <span>إتاحة API ضمن الخطة</span>
                  </div>
                </div>
                <a className={`${styles.btnSecondary} mt-8 w-full text-center`} href="#preview-login">متابعة المعاينة</a>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* 7. Auth / Settings Presentation */}
        <section className={styles.section} id="preview-account">
          <FadeIn>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>أمان وحماية</h2>
              <p className={styles.sectionSubtitle}>
                واجهات تسجيل دخول وإعدادات مصممة لتوفير أقصى درجات الحماية والراحة
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <FadeIn delay={0.1}>
              <div className={styles.authBox}>
                <div className="text-center mb-8">
                  <BrandLogo className={styles.brandLogoAccount} />
                  <div className="w-12 h-12 rounded-full bg-[#161c24] border border-[#ffffff1a] flex items-center justify-center mx-auto mb-4">
                    <Lock className="text-[#0fc9a7]" size={24} />
                  </div>
                  <h3 className="text-2xl font-bold">تسجيل الدخول</h3>
                  <p className="text-[#94a3b8] text-sm mt-2">مرحباً بعودتك إلى isaudi.ai</p>
                </div>
                
                 <div className="space-y-4">
                  <div>
                    <label className={styles.label}>البريد الإلكتروني</label>
                    <input type="email" placeholder="name@company.com" className={styles.input} aria-describedby="preview-auth-note" />
                  </div>
                  <a href="#preview-login" className={`${styles.btnPrimary} block w-full mt-2 text-center`}>فتح تجربة رمز التحقق</a>
                  <p id="preview-auth-note" className="text-xs text-[#64748b] text-center">واجهة توضيحية فقط — لن يتم إرسال رمز أو حفظ البريد.</p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="space-y-4">
                <div className={`${styles.card} p-6`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-lg mb-1">حالة الحساب</h4>
                      <p className="text-sm text-[#94a3b8]">m••••@example.com · بيانات توضيحية</p>
                    </div>
                    <span className="px-3 py-1 bg-[#10b981]/10 text-[#10b981] rounded-full text-sm font-medium">موثق</span>
                  </div>
                </div>
                
                <div className={`${styles.card} p-6`}>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-lg">الخطة الحالية</h4>
                    <span className="text-[#e6b95c] font-bold">النمو</span>
                  </div>
                  <div className="flex justify-between text-sm text-[#94a3b8] border-t border-[#ffffff1a] pt-4">
                    <span>تاريخ التجديد</span>
                    <span>يظهر بعد تسجيل الدخول الفعلي</span>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        <section className={`${styles.section} ${styles.finalCta}`} id="preview-final-cta">
          <FadeIn>
            <div className={styles.finalCtaInner}>
              <span className={styles.kicker}>معاينة التصميم الجديدة</span>
              <h2 className={styles.sectionTitle}>تجربة واحدة لفهم أرقام متجرك</h2>
              <p className={styles.sectionSubtitle}>
                استعرض تدفق الدخول التجريبي أو ارجع إلى الخطط. لن يتم إنشاء حساب أو تنفيذ أي عملية حقيقية.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
                <a className={`${styles.btnPrimary} px-8 py-4`} href="#preview-login">جرّب تسجيل الدخول</a>
                <a href="#preview-pricing" className={`${styles.btnSecondary} px-8 py-4`}>راجع الأسعار</a>
              </div>
            </div>
          </FadeIn>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#ffffff1a] bg-[#06090c] pt-16 pb-8">
        <div className={styles.container}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-1 md:col-span-2">
              <BrandLogo className={styles.brandLogoFooter} />
              <p className="text-[#94a3b8] max-w-sm">
                 منصة سعودية تساعد أصحاب المتاجر على فهم المبيعات والتكاليف والأرباح عبر تقارير واضحة وتحليل ذكي.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">المنتج</h4>
              <ul className="space-y-2 text-[#94a3b8]">
                 <li><a href="#preview-solutions">المميزات</a></li>
                 <li><a href="#preview-pricing">الأسعار</a></li>
                 <li><a href="#preview-reports">التقارير</a></li>
                 <li><a href="#preview-assistant">المساعد الذكي</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">الشركة</h4>
              <ul className="space-y-2 text-[#94a3b8]">
                 <li><a href="#preview-value">عن isaudi</a></li>
                 <li><a href="#preview-final-cta">تواصل معنا</a></li>
                 <li><a href="#preview-account">الأمان والخصوصية</a></li>
                 <li><a href="#preview-home">العودة للأعلى</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[#ffffff1a] pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[#64748b] text-sm">
            <p>© 2026 isaudi.ai. جميع الحقوق محفوظة.</p>
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} />
              <span>معاينة تصميم معزولة — لا تنفذ عمليات حقيقية</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
