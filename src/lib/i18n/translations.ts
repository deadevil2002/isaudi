export type Lang = "ar" | "en";

const translations: Record<string, { ar: string; en: string }> = {
  "hero.badge": {
    ar: "جديد: الذكاء الاصطناعي للتجارة الإلكترونية",
    en: "New: AI for ecommerce in Saudi Arabia",
  },
  "hero.title.main": {
    ar: "ذكاء اصطناعي يحلل متجرك ويعطيك",
    en: "AI that analyzes your store and gives you a",
  },
  "hero.title.highlight": {
    ar: "خطة واضحة",
    en: "clear plan",
  },
  "hero.title.suffix": {
    ar: "لزيادة مبيعاتك",
    en: "to increase your sales",
  },
  "hero.subtitle": {
    ar: "اربط متجرك في سلة أو زد أو شوبيفاي واحصل على تقرير عملي بدون أرقام معقدة. اكتشف فرص النمو الضائعة فوراً.",
    en: "Connect your Salla, Zid or Shopify store and get a practical report without complex numbers. Discover missed growth opportunities instantly.",
  },
  "hero.cta.how": {
    ar: "شاهد كيف يعمل",
    en: "See how it works",
  },
  "hero.cta.freeReport": {
    ar: "احصل على تقرير مجاني",
    en: "Get a free report",
  },
  "hero.disclaimer": {
    ar: "التقرير المجاني عرض تجريبي لمرة واحدة، مبني على البيانات المدخلة فقط، ولا يتم حفظ البيانات أو تقديم دعم مباشر إلا بعد إنشاء حساب.",
    en: "The free report is a one-time demo based only on the data you provide. Data is not stored and direct support is available only after creating an account.",
  },
  "hero.badge.fast": {
    ar: "تحليل سريع",
    en: "Fast analysis",
  },
  "hero.badge.security": {
    ar: "نطبق أفضل ممارسات الأمان",
    en: "We follow security best practices",
  },
  "hero.mock.totalSales": {
    ar: "إجمالي المبيعات",
    en: "Total sales",
  },
  "hero.mock.expectedProfit": {
    ar: "الأرباح المتوقعة",
    en: "Expected profit",
  },
  "hero.mock.currencySar": {
    ar: "ريال",
    en: "SAR",
  },
  "hero.mock.competitorAnalysis": {
    ar: "تحليل المنافسين",
    en: "Competitor analysis",
  },
  "how.heading": {
    ar: "كيف يعمل isaudi.ai؟",
    en: "How does isaudi.ai work?",
  },
  "how.subtitle": {
    ar: "ثلاث خطوات بسيطة تفصلك عن فهم أعمق لمتجرك ونمو مبيعاتك",
    en: "Three simple steps separate you from deeper store insights and higher sales.",
  },
  "how.step1.title": {
    ar: "اربط متجرك",
    en: "Connect your store",
  },
  "how.step1.description": {
    ar: "بضغطة زر واحدة، اربط متجرك مع سلة أو زد لاستيراد البيانات بشكل آمن.",
    en: "With one click, connect your store on Salla or Zid and import data securely.",
  },
  "how.step2.title": {
    ar: "نحلل البيانات",
    en: "We analyze your data",
  },
  "how.step2.description": {
    ar: "تقوم خوارزميات الذكاء الاصطناعي بتحليل أداء مبيعاتك ومقارنتها بالسوق.",
    en: "AI analyzes your sales performance and benchmarks it against the market.",
  },
  "how.step3.title": {
    ar: "تحصل على خطة",
    en: "You get a plan",
  },
  "how.step3.description": {
    ar: "استلم تقريرًا شاملاً يحتوي على خطوات عملية لزيادة المبيعات وتحسين الأداء.",
    en: "Receive a full report with practical steps to increase sales and improve performance.",
  },
  "sample.heading": {
    ar: "تقارير دقيقة تكشف لك",
    en: "Accurate reports reveal",
  },
  "sample.heading.highlight": {
    ar: "أسرار السوق",
    en: "market secrets",
  },
  "sample.subtitle": {
    ar: "لا نكتفي بالأرقام المجردة. نظامنا يحلل أسعار المنافسين، وسلوك العملاء، ويعطيك توصيات واضحة: \"ارفع السعر\"، \"أضف هذا المنتج\"، \"حسن وصف المنتج\".",
    en: "We do more than raw numbers. We analyze competitors' prices and customer behavior and give you clear recommendations: \"Raise the price\", \"Add this product\", \"Improve the product description\".",
  },
  "sample.point1": {
    ar: "مقارنة أسعار لحظية مع المنافسين",
    en: "Instant price comparison with competitors",
  },
  "sample.point2": {
    ar: "تنبيهات انخفاض المخزون الذكية",
    en: "Smart low-stock alerts",
  },
  "sample.point3": {
    ar: "تحليل الكلمات المفتاحية الأكثر بحثاً",
    en: "Analysis of top searched keywords",
  },
  "sample.cta": {
    ar: "شاهد مثال حي",
    en: "View a live example",
  },
  "sample.stat1.label": {
    ar: "إجمالي المبيعات",
    en: "Total sales",
  },
  "sample.stat1.deltaLabel": {
    ar: "مقارنة بالشهر الماضي",
    en: "vs last month",
  },
  "sample.stat2.label": {
    ar: "متوسط السلة",
    en: "Average order value",
  },
  "sample.stat3.label": {
    ar: "معدل التحويل",
    en: "Conversion rate",
  },
  "sample.stat3.note": {
    ar: "يحتاج تحسين",
    en: "Needs improvement",
  },
  "sample.insight.title": {
    ar: "توصية لزيادة المبيعات",
    en: "Recommendation to increase sales",
  },
  "sample.insight.body": {
    ar: "منتج \"ساعة ذكية برو\" سعره أعلى من متوسط السوق بنسبة 15%. نقترح خفض السعر إلى 299 ر.س لزيادة معدل التحويل المتوقع بنسبة 25%.",
    en: "The product \"Smart Watch Pro\" is priced 15% above the market average. We suggest lowering the price to 299 SAR to increase the expected conversion rate by 25%.",
  },
  "sample.insight.cta": {
    ar: "تطبيق التوصية",
    en: "Apply the recommendation",
  },
  "trust.heading": {
    ar: "متوافق مع أشهر منصات التجارة الإلكترونية",
    en: "Compatible with the most popular ecommerce platforms",
  },
  "trust.subtitle": {
    ar: "حاليًا عبر CSV، والربط المباشر يتم تفعيله تدريجيًا حسب توفره.",
    en: "Currently via CSV, with direct integrations being rolled out gradually as they become available.",
  },
  "trust.card1.title": {
    ar: "بيانات مشفرة",
    en: "Encrypted data",
  },
  "trust.card1.body": {
    ar: "جميع بياناتك مشفرة بأحدث تقنيات التشفير العالمية (AES-256).",
    en: "All your data is encrypted using modern industry-standard encryption (AES-256).",
  },
  "trust.card2.title": {
    ar: "خصوصية تامة",
    en: "Full privacy",
  },
  "trust.card2.body": {
    ar: "لا نشارك بياناتك مع أي طرف ثالث. أنت المالك الوحيد لبياناتك.",
    en: "We never share your data with third parties. You remain the sole owner of your data.",
  },
  "trust.card3.title": {
    ar: "بنية تحتية سعودية",
    en: "Saudi-hosted infrastructure",
  },
  "trust.card3.body": {
    ar: "خوادمنا مستضافة داخل المملكة العربية السعودية لضمان سرعة وسيادة البيانات.",
    en: "Our servers are hosted inside Saudi Arabia to ensure speed and data sovereignty.",
  },
  "sample.alt.backgroundDecoration": {
    ar: "صورة خلفية توضيحية",
    en: "Decorative background illustration",
  },
  "sample.status.active": {
    ar: "نشط الآن",
    en: "Active now",
  },
  "verify.invalid.title": {
    ar: "الرابط غير صحيح",
    en: "Invalid link",
  },
  "verify.invalid.body": {
    ar: "تحقق من الرابط أو اطلب رسالة تفعيل جديدة.",
    en: "Check the link or request a new verification email.",
  },
  "verify.invalid.resend": {
    ar: "إعادة إرسال رابط التفعيل",
    en: "Resend verification link",
  },
  "verify.expired.title": {
    ar: "انتهت صلاحية الرابط",
    en: "Link expired",
  },
  "verify.expired.body": {
    ar: "صلاحية رابط التفعيل انتهت. يمكنك تسجيل الدخول وطلب رسالة تفعيل جديدة.",
    en: "Your verification link has expired. You can log in and request a new one.",
  },
  "verify.error.title": {
    ar: "حدث خطأ غير متوقع",
    en: "Unexpected error",
  },
  "verify.error.body": {
    ar: "يرجى المحاولة مرة أخرى لاحقًا.",
    en: "Please try again later.",
  },
  "verify.loading.title": {
    ar: "جاري التحقق من رابط التفعيل...",
    en: "Verifying your link...",
  },
  "verify.loading.body": {
    ar: "سيتم توجيهك تلقائيًا بعد إكمال التحقق.",
    en: "You will be redirected automatically once verification is complete.",
  },
  "verify.common.goToLogin": {
    ar: "الانتقال إلى تسجيل الدخول",
    en: "Go to login",
  },
  "verify.common.backToLogin": {
    ar: "العودة إلى تسجيل الدخول",
    en: "Back to login",
  },
  "dashboard.menu.dashboard": {
    ar: "لوحة التحكم",
    en: "Dashboard",
  },
  "dashboard.menu.reports": {
    ar: "التقارير",
    en: "Reports",
  },
  "dashboard.menu.costs": {
    ar: "التكاليف",
    en: "Costs",
  },
  "dashboard.menu.connectStore": {
    ar: "ربط المتجر",
    en: "Connect store",
  },
  "dashboard.menu.settings": {
    ar: "الإعدادات",
    en: "Settings",
  },
  "dashboard.stats.productsNote": {
    ar: "(إجمالي المتجر)",
    en: "(full store)",
  },
  "dashboard.stats.ordersNote": {
    ar: "(آخر تقرير)",
    en: "(latest report)",
  },
  "dashboard.stats.salesNote": {
    ar: "(آخر تقرير)",
    en: "(latest report)",
  },
  "dashboard.stats.productsLabel": {
    ar: "المنتجات",
    en: "Products",
  },
  "dashboard.stats.ordersLabel": {
    ar: "الطلبات",
    en: "Orders",
  },
  "dashboard.stats.salesLabel": {
    ar: "المبيعات",
    en: "Sales",
  },
  "dashboard.stats.excluded": {
    ar: "تم استبعاد {orders} طلبات ملغاة/محذوفة بمجموع {amount} SAR من التحليلات.",
    en: "Excluded {orders} cancelled/removed orders totalling {amount} SAR from analytics.",
  },
  "dashboard.banner.dedup": {
    ar: "نفس بيانات التحليل السابق — ما تغير شي",
    en: "Same analysis data as previous — no change",
  },
  "dashboard.costs.card.title": {
    ar: "إدخال التكاليف",
    en: "Enter costs",
  },
  "dashboard.costs.card.button": {
    ar: "اذهب لصفحة التكاليف",
    en: "Go to costs page",
  },
  "dashboard.costs.missing": {
    ar: "بعض المنتجات في التقرير الأخير تفتقد إلى تكاليف ثابتة ({count}). يوصى بإدخالها لحساب الربحية بدقة.",
    en: "Some products in the latest report are missing fixed costs ({count}). Adding them will improve profitability accuracy.",
  },
  "dashboard.trend.title": {
    ar: "اتجاه الأداء (أسبوعي)",
    en: "Performance trend (weekly)",
  },
  "common.upgrade": {
    ar: "الترقية",
    en: "Upgrade",
  },
  "dashboard.trend.lock.week": {
    ar: "أسبوع",
    en: "Week",
  },
  "dashboard.trend.lock.metrics": {
    ar: "مبيعات/ربح/هامش",
    en: "Sales / profit / margin",
  },
  "dashboard.trend.lock.message": {
    ar: "الميزة متاحة في الخطط المدفوعة",
    en: "This feature is available on paid plans",
  },
  "dashboard.trend.refresh.loading": {
    ar: "جاري التحميل…",
    en: "Loading…",
  },
  "dashboard.trend.refresh": {
    ar: "تحديث الاتجاه",
    en: "Refresh trend",
  },
  "dashboard.trend.summary.title": {
    ar: "ملخص الأسبوع الأخير",
    en: "Last week summary",
  },
  "common.sales": {
    ar: "المبيعات:",
    en: "Sales:",
  },
  "common.profit": {
    ar: "الربح:",
    en: "Profit:",
  },
  "common.margin": {
    ar: "الهامش:",
    en: "Margin:",
  },
  "common.orders": {
    ar: "الطلبات:",
    en: "Orders:",
  },
  "dashboard.compare.label": {
    ar: "الأسبوع الأخير مقابل السابق: ",
    en: "Last week vs previous: ",
  },
  "common.status.improved": {
    ar: "تحسن",
    en: "Improved",
  },
  "common.status.declined": {
    ar: "تراجع",
    en: "Declined",
  },
  "common.status.noChange": {
    ar: "ما تغير شي",
    en: "No change",
  },
  "dashboard.compare.delta.sales": {
    ar: "المبيعات: ",
    en: "Sales: ",
  },
  "dashboard.compare.delta.profit": {
    ar: "الربح: ",
    en: "Profit: ",
  },
  "dashboard.compare.delta.margin": {
    ar: "الهامش: ",
    en: "Margin: ",
  },
  "dashboard.compare.delta.marginPts": {
    ar: " نقطة",
    en: " pts",
  },
  "dashboard.welcomeLine": {
    ar: "مرحبًا، {email}",
    en: "Welcome, {email}",
  },
  "dashboard.plan.label": {
    ar: "الباقة الحالية",
    en: "Current plan",
  },
  "dashboard.plan.upgradeDesc": {
    ar: "احصل على تحليلات متقدمة وتقارير غير محدودة",
    en: "Get advanced analytics and unlimited reports",
  },
  "dashboard.plan.premiumDesc": {
    ar: "أنت مشترك في الباقة المميزة. استمتع بكافة المزايا.",
    en: "You are on a premium plan. Enjoy all features.",
  },
  "dashboard.plan.manage": {
    ar: "إدارة الاشتراك",
    en: "Manage subscription",
  },
  "dashboard.plan.upgrade": {
    ar: "الترقية",
    en: "Upgrade",
  },
  "dashboard.trend.card.profit": {
    ar: "ربح ",
    en: "Profit ",
  },
  "dashboard.trend.card.margin": {
    ar: "هامش ",
    en: "Margin ",
  },
  "dashboard.trend.card.orders": {
    ar: "طلبات ",
    en: "Orders ",
  },
  "dashboard.insights.title": {
    ar: "ملخص ذكي لهذا الأسبوع",
    en: "Smart summary for this week",
  },
  "dashboard.insights.lock.message": {
    ar: "الميزة متاحة في الخطط المدفوعة",
    en: "This feature is available on paid plans",
  },
  "dashboard.insights.loading": {
    ar: "جاري تحميل الملخص الذكي…",
    en: "Loading smart summary…",
  },
  "dashboard.insights.keyHighlights": {
    ar: "أهم الملاحظات",
    en: "Key highlights",
  },
  "dashboard.insights.suggestedActions": {
    ar: "خطوات مقترحة",
    en: "Suggested actions",
  },
  "dashboard.insights.placeholder.summary": {
    ar: "ملخص يوضح أسباب تغير الأداء.",
    en: "Summary explaining performance changes.",
  },
  "dashboard.insights.placeholder.profitable": {
    ar: "قائمة بأعلى المنتجات ربحية.",
    en: "List of most profitable products.",
  },
  "dashboard.insights.placeholder.lowMargin": {
    ar: "تنبيهات عن المنتجات ذات الهامش المنخفض.",
    en: "Alerts for low-margin products.",
  },
  "dashboard.insights.placeholder.actionsMargin": {
    ar: "اقتراحات لتحسين الهامش.",
    en: "Suggestions to improve margins.",
  },
  "dashboard.insights.placeholder.actionsWinners": {
    ar: "متابعة المنتجات الرابحة.",
    en: "Follow-up on winning products.",
  },
  "dashboard.insights.placeholder.actionsReview": {
    ar: "مراجعة التكاليف والتسعير.",
    en: "Review costs and pricing.",
  },
  "dashboard.insights.noHighlights": {
    ar: "لا توجد ملاحظات لهذا الأسبوع.",
    en: "No highlights for this week.",
  },
  "dashboard.insights.noActions": {
    ar: "لا توجد خطوات مقترحة لهذا الأسبوع.",
    en: "No suggested actions for this week.",
  },
  "dashboard.insights.topProfitProducts": {
    ar: "أعلى المنتجات ربحية",
    en: "Top profit products",
  },
  "dashboard.insights.lowMarginProducts": {
    ar: "منتجات ذات هامش منخفض",
    en: "Low-margin products",
  },
  "dashboard.insights.notEnoughProfitData": {
    ar: "لا توجد بيانات كافية عن المنتجات الرابحة.",
    en: "Not enough data about profitable products.",
  },
  "dashboard.insights.noLowMargin": {
    ar: "لا توجد منتجات بهامش منخفض واضح لهذا الأسبوع.",
    en: "No clearly low-margin products this week.",
  },
  "dashboard.insights.noData": {
    ar: "لا توجد بيانات للملخص الذكي بعد.",
    en: "No smart summary data yet.",
  },
  "reports.title": {
    ar: "التقارير",
    en: "Reports",
  },
  "reports.backToDashboard": {
    ar: "العودة للوحة التحكم",
    en: "Back to dashboard",
  },
  "reports.weeklySummaries": {
    ar: "الملخصات الأسبوعية",
    en: "Weekly summaries",
  },
  "reports.upgrade": {
    ar: "الترقية",
    en: "Upgrade",
  },
  "reports.lock.week": {
    ar: "أسبوع",
    en: "Week",
  },
  "reports.lock.metrics": {
    ar: "مبيعات/ربح/هامش",
    en: "Sales / profit / margin",
  },
  "reports.lock.message": {
    ar: "الميزة متاحة في الخطط المدفوعة",
    en: "This feature is available on paid plans",
  },
  "reports.loading": {
    ar: "جاري التحميل…",
    en: "Loading…",
  },
  "reports.empty": {
    ar: "لا توجد ملخصات أسبوعية بعد.",
    en: "No weekly summaries yet.",
  },
  "reports.table.week": {
    ar: "الأسبوع",
    en: "Week",
  },
  "reports.table.sales": {
    ar: "المبيعات",
    en: "Sales",
  },
  "reports.table.profit": {
    ar: "الربح",
    en: "Profit",
  },
  "reports.table.margin": {
    ar: "الهامش",
    en: "Margin",
  },
  "reports.table.orders": {
    ar: "عدد الطلبات",
    en: "Orders",
  },
  "reports.table.report": {
    ar: "التقرير",
    en: "Report",
  },
  "reports.table.compare": {
    ar: "مقارنة",
    en: "Compare",
  },
  "reports.openReport": {
    ar: "فتح التقرير",
    en: "Open report",
  },
  "reports.notAvailable": {
    ar: "غير متاح",
    en: "Not available",
  },
  "reports.compare.loading": {
    ar: "جاري المقارنة…",
    en: "Comparing…",
  },
  "reports.compare.button": {
    ar: "مقارنة مع الأسبوع السابق",
    en: "Compare with previous week",
  },
  "reports.compare.result": {
    ar: "النتيجة:",
    en: "Result:",
  },
  "reports.compare.sales": {
    ar: "المبيعات",
    en: "Sales",
  },
  "reports.compare.profit": {
    ar: "الربح",
    en: "Profit",
  },
  "reports.compare.margin": {
    ar: "الهامش",
    en: "Margin",
  },
  "reports.compare.orders": {
    ar: "الطلبات",
    en: "Orders",
  },
  "reports.compare.noPrevious": {
    ar: "لا يوجد أسبوع سابق للمقارنة.",
    en: "No previous week to compare.",
  },
  "costs.title": {
    ar: "التكاليف",
    en: "Costs",
  },
  "costs.backToDashboard": {
    ar: "العودة للوحة التحكم",
    en: "Back to dashboard",
  },
  "costs.description": {
    ar: "هذه التكاليف ثابتة لكل منتج وتُستخدم لاحقاً لحساب الربحية في التقارير.",
    en: "These fixed costs per product are used later to calculate profitability in reports.",
  },
  "costs.search.placeholder": {
    ar: "ابحث بالاسم أو SKU",
    en: "Search by name or SKU",
  },
  "costs.filter.soldOnly": {
    ar: "مباع في آخر تقرير فقط",
    en: "Sold only in latest report",
  },
  "costs.filter.button": {
    ar: "تصفية",
    en: "Filter",
  },
  "costs.table.product": {
    ar: "المنتج",
    en: "Product",
  },
  "costs.table.sku": {
    ar: "SKU",
    en: "SKU",
  },
  "costs.table.price": {
    ar: "سعر البيع",
    en: "Sale price",
  },
  "costs.table.totalCost": {
    ar: "تكلفة إجمالية",
    en: "Total cost",
  },
  "costs.table.netProfit": {
    ar: "صافي ربح",
    en: "Net profit",
  },
  "costs.table.margin": {
    ar: "هامش",
    en: "Margin",
  },
  "costs.table.edit": {
    ar: "تعديل",
    en: "Edit",
  },
  "costs.loading": {
    ar: "جاري التحميل...",
    en: "Loading...",
  },
  "costs.empty": {
    ar: "لا توجد منتجات متاحة.",
    en: "No products available.",
  },
  "costs.summary.noPrice": {
    ar: "لا تتوفر لدينا حالياً قيمة سعر بيع لهذا المنتج.",
    en: "We currently do not have a sale price for this product.",
  },
  "costs.summary.salePrice": {
    ar: "سعر البيع",
    en: "Sale price",
  },
  "costs.summary.totalCost": {
    ar: "إجمالي التكلفة",
    en: "Total cost",
  },
  "costs.summary.netProfit": {
    ar: "صافي الربح",
    en: "Net profit",
  },
  "costs.summary.margin": {
    ar: "الهامش",
    en: "Margin",
  },
  "costs.dropship.label": {
    ar: "وضع الدروبشيبنق",
    en: "Dropshipping mode",
  },
  "costs.dropship.hint": {
    ar: "يبسط الحقول ويضبط الباقي تلقائيًا",
    en: "Simplifies fields and auto-adjusts the rest",
  },
  "costs.field.purchase": {
    ar: "تكلفة الشراء (SAR)",
    en: "Purchase cost (SAR)",
  },
  "costs.field.labor": {
    ar: "العمل (SAR)",
    en: "Labor (SAR)",
  },
  "costs.field.shipping": {
    ar: "الشحن (SAR)",
    en: "Shipping (SAR)",
  },
  "costs.field.packaging": {
    ar: "التغليف (SAR)",
    en: "Packaging (SAR)",
  },
  "costs.field.ads": {
    ar: "إعلانات للوحدة (SAR)",
    en: "Ads per unit (SAR)",
  },
  "costs.field.paymentFee": {
    ar: "رسوم الدفع (%)",
    en: "Payment fee (%)",
  },
  "costs.field.shippingUnit": {
    ar: "الشحن للوحدة (SAR)",
    en: "Shipping per unit (SAR)",
  },
  "costs.advanced.toggle.show": {
    ar: "خيارات متقدمة",
    en: "Advanced options",
  },
  "costs.advanced.toggle.hide": {
    ar: "إخفاء الخيارات المتقدمة",
    en: "Hide advanced options",
  },
  "costs.summary.cardTitle": {
    ar: "ملخص سريع",
    en: "Quick summary",
  },
  "costs.actions.save": {
    ar: "حفظ",
    en: "Save",
  },
  "costs.actions.cancel": {
    ar: "إلغاء",
    en: "Cancel",
  },
  "billing.plan.basic": {
    ar: "البداية",
    en: "Basic",
  },
  "billing.plan.pro": {
    ar: "النمو",
    en: "Growth",
  },
  "billing.plan.business": {
    ar: "المؤسسات",
    en: "Business",
  },
  "billing.plan.basic.description": {
    ar: "للمتاجر الناشئة",
    en: "For emerging stores",
  },
  "billing.plan.pro.description": {
    ar: "للمتاجر الطموحة",
    en: "For ambitious stores",
  },
  "billing.plan.business.description": {
    ar: "للشركات الكبرى",
    en: "For large enterprises",
  },
  "billing.plan.basic.f1": {
    ar: "متجر واحد",
    en: "One store",
  },
  "billing.plan.basic.f2": {
    ar: "ربط CSV (المنتجات والطلبات)",
    en: "CSV connect (products and orders)",
  },
  "billing.plan.basic.f3": {
    ar: "تقرير أساسي من بيانات متجرك",
    en: "Basic report from your store data",
  },
  "billing.plan.basic.f4": {
    ar: "مساعد ذكي يشرح لك وش تسوي (إرشادي)",
    en: "Smart assistant to explain what to do (guidance)",
  },
  "billing.plan.basic.f5": {
    ar: "دعم عبر البريد",
    en: "Email support",
  },
  "billing.plan.pro.f1": {
    ar: "حتى 3 متاجر",
    en: "Up to 3 stores",
  },
  "billing.plan.pro.f2": {
    ar: "ربط CSV + جاهزية ربط سلة (عند توفر ربط التطبيق)",
    en: "CSV connect + Salla-ready (when app connection is available)",
  },
  "billing.plan.pro.f3": {
    ar: "تحديث يومي للبيانات (إذا كانت البيانات مرفوعة/مربوطة)",
    en: "Daily data refresh (if data is uploaded/connected)",
  },
  "billing.plan.pro.f4": {
    ar: "توصيات ذكية موجهة لمتجرك (إرشادي + مبني على بياناتك)",
    en: "Smart recommendations tailored to your store (guided + data-based)",
  },
  "billing.plan.pro.f5": {
    ar: "أولوية دعم",
    en: "Priority support",
  },
  "billing.plan.business.f1": {
    ar: "حتى 10 متاجر",
    en: "Up to 10 stores",
  },
  "billing.plan.business.f2": {
    ar: "تخصيص التقرير حسب نشاطك",
    en: "Report customization based on your business",
  },
  "billing.plan.business.f3": {
    ar: "دعم مباشر",
    en: "Direct support",
  },
  "billing.plan.business.f4": {
    ar: "جلسة مراجعة شهرية",
    en: "Monthly review session",
  },
  "billing.title": {
    ar: "إدارة الاشتراك",
    en: "Manage subscription",
  },
  "billing.currentPlan": {
    ar: "الخطة الحالية",
    en: "Current plan",
  },
  "billing.freeBadge": {
    ar: "مجاني",
    en: "Free",
  },
  "billing.expiresAt": {
    ar: "ينتهي في",
    en: "Expires at",
  },
  "billing.noActive": {
    ar: "لا يوجد اشتراك نشط",
    en: "No active subscription",
  },
  "billing.status.processed": {
    ar: "تم استلام طلب الدفع بنجاح! سيتم تحديث اشتراكك قريباً.",
    en: "Payment request received successfully! Your subscription will be updated soon.",
  },
  "billing.choosePlan": {
    ar: "اختر خطتك المناسبة",
    en: "Choose the right plan for you",
  },
  "billing.toggle.monthly": {
    ar: "شهريًا",
    en: "Monthly",
  },
  "billing.toggle.yearly": {
    ar: "سنويًا",
    en: "Yearly",
  },
  "billing.toggle.save": {
    ar: "(وفر 20%)",
    en: "(Save 20%)",
  },
  "billing.badge.popular": {
    ar: "الأكثر شيوعاً",
    en: "Most popular",
  },
  "billing.currency": {
    ar: "ريال",
    en: "SAR",
  },
  "billing.per.month": {
    ar: "شهريًا",
    en: "month",
  },
  "billing.per.year": {
    ar: "سنويًا",
    en: "year",
  },
  "billing.button.current": {
    ar: "باقتك الحالية",
    en: "Your current plan",
  },
  "billing.button.subscribeYearly": {
    ar: "اشترك سنويًا",
    en: "Subscribe yearly",
  },
  "billing.button.subscribeMonthly": {
    ar: "اشترك شهريًا",
    en: "Subscribe monthly",
  },
  "billing.error.generic": {
    ar: "حدث خطأ أثناء إنشاء عملية الدفع. يرجى المحاولة مرة أخرى.",
    en: "An error occurred while creating the payment. Please try again.",
  },
  "connect.salla.title": {
    ar: "ربط متجر سلة",
    en: "Connect Salla store",
  },
  "connect.salla.description": {
    ar: "سيتم توجيهك إلى صفحة سلة للموافقة على الأذونات المطلوبة لاستيراد المنتجات والطلبات لتحليلها.",
    en: "You will be redirected to Salla to approve the permissions needed to import products and orders for analysis.",
  },
  "connect.salla.error.config_missing": {
    ar: "ربط سلة يحتاج إعداد تطبيق مطور. استخدم CSV مؤقتًا.",
    en: "Salla integration requires a developer app configuration. Use CSV for now.",
  },
  "connect.salla.error.no_code": {
    ar: "فشل الحصول على رمز التحقق.",
    en: "Failed to obtain authorization code.",
  },
  "connect.salla.error.token_failed": {
    ar: "فشل تبادل الرمز. يرجى المحاولة مرة أخرى.",
    en: "Token exchange failed. Please try again.",
  },
  "connect.salla.error.server_error": {
    ar: "حدث خطأ في الخادم.",
    en: "A server error occurred.",
  },
  "connect.salla.error.unknown": {
    ar: "حدث خطأ غير معروف.",
    en: "An unknown error occurred.",
  },
  "connect.salla.button.primary": {
    ar: "بدء الربط مع سلة",
    en: "Start connecting with Salla",
  },
  "connect.salla.button.csv": {
    ar: "أو استخدم رفع ملف CSV",
    en: "Or use CSV upload",
  },
  "connect.salla.note": {
    ar: "نحن نطلب فقط أذونات القراءة (read-only) للبيانات اللازمة للتحليل.",
    en: "We only request read-only permissions for the data needed for analysis.",
  },
  "connect.csv.title": {
    ar: "رفع البيانات يدويًا (CSV)",
    en: "Upload data manually (CSV)",
  },
  "connect.csv.subtitle": {
    ar: "ارفع ملفي المنتجات والطلبات ثم ابدأ التحليل مباشرة.",
    en: "Upload both products and orders files, then start the analysis immediately.",
  },
  "connect.csv.error.filesRequired": {
    ar: "يجب اختيار ملفي المنتجات والطلبات معًا.",
    en: "You must select both products and orders files together.",
  },
  "connect.csv.error.uploadFailed": {
    ar: "فشل رفع الملفات",
    en: "Failed to upload files",
  },
  "connect.csv.error.analysisFailed": {
    ar: "فشل تشغيل التحليل",
    en: "Failed to start analysis",
  },
  "connect.csv.error.unexpected": {
    ar: "خطأ غير متوقع",
    en: "Unexpected error",
  },
  "connect.csv.success.analysisStarted": {
    ar: "تم تشغيل التحليل بنجاح! سيتم تحويلك للوحة التحكم.",
    en: "Analysis started successfully! You will be redirected to the dashboard.",
  },
  "connect.csv.warnings.title": {
    ar: "ملاحظات:",
    en: "Notes:",
  },
  "connect.csv.warnings.more": {
    ar: "+ {count} سطر إضافي...",
    en: "+ {count} additional lines...",
  },
  "connect.csv.products.title": {
    ar: "ملف المنتجات (Salla)",
    en: "Products file (Salla)",
  },
  "connect.csv.products.help": {
    ar: "يدعم رؤوس عربية ومتعددة الأسطر. استخدم تصدير سلة.",
    en: "Supports Arabic headers and multi-line rows. Use Salla export.",
  },
  "connect.csv.orders.title": {
    ar: "ملف الطلبات (Salla)",
    en: "Orders file (Salla)",
  },
  "connect.csv.orders.help": {
    ar: "يجب أن يحتوي على عمود أسماء المنتجات مع SKU.",
    en: "Must contain a column with product names and SKU.",
  },
  "connect.csv.button.loading": {
    ar: "جاري التشغيل...",
    en: "Running...",
  },
  "connect.csv.button.run": {
    ar: "تشغيل التحليل",
    en: "Run analysis",
  },
  "settings.title": {
    ar: "الإعدادات",
    en: "Settings",
  },
  "settings.subtitle": {
    ar: "إدارة حسابك، حالة البريد الإلكتروني، والباقة الحالية.",
    en: "Manage your account, email status, and subscription plan.",
  },
  "settings.backToDashboard": {
    ar: "الرجوع للوحة التحكم",
    en: "Back to dashboard",
  },
  "settings.account.title": {
    ar: "الحساب",
    en: "Account",
  },
  "settings.account.email": {
    ar: "البريد الإلكتروني",
    en: "Email",
  },
  "settings.account.verificationStatus": {
    ar: "حالة التفعيل",
    en: "Verification status",
  },
  "settings.account.verified": {
    ar: "مفعّل",
    en: "Verified",
  },
  "settings.account.notVerified": {
    ar: "غير مفعّل",
    en: "Not verified",
  },
  "settings.verification.sending": {
    ar: "جاري الإرسال...",
    en: "Sending...",
  },
  "settings.verification.resend": {
    ar: "إعادة إرسال رابط التفعيل",
    en: "Resend verification link",
  },
  "settings.verification.alreadyVerified": {
    ar: "بريدك الإلكتروني مفعّل بالفعل.",
    en: "Your email is already verified.",
  },
  "settings.verification.sent": {
    ar: "تم إرسال رابط التفعيل إلى بريدك الإلكتروني.",
    en: "Verification link sent to your email.",
  },
  "settings.verification.error.sendFailed": {
    ar: "تعذر إرسال رابط التفعيل",
    en: "Failed to send verification link",
  },
  "settings.verification.error.unexpected": {
    ar: "حدث خطأ غير متوقع.",
    en: "Unexpected error occurred.",
  },
  "settings.plan.title": {
    ar: "الباقة",
    en: "Plan",
  },
  "settings.plan.current": {
    ar: "الباقة الحالية",
    en: "Current plan",
  },
  "settings.plan.expiry": {
    ar: "تاريخ انتهاء الباقة",
    en: "Plan expiry date",
  },
  "settings.plan.manage": {
    ar: "إدارة الاشتراك",
    en: "Manage subscription",
  },
  "settings.logout.title": {
    ar: "تسجيل الخروج",
    en: "Log out",
  },
  "settings.logout.body": {
    ar: "يمكنك تسجيل الخروج من حسابك الحالي والعودة لاحقًا.",
    en: "You can log out of your account and come back later.",
  },
  "settings.logout.loggingOut": {
    ar: "جاري تسجيل الخروج...",
    en: "Logging out...",
  },
  "settings.logout.cta": {
    ar: "تسجيل الخروج",
    en: "Log out",
  },
  "pricing.title": {
    ar: "خطط أسعار تناسب حجم تجارتك",
    en: "Pricing plans for every store size",
  },
  "pricing.subtitle": {
    ar: "اختر الخطة المناسبة لاحتياجاتك وابدأ في تنمية تجارتك.",
    en: "Choose the plan that fits your needs and grow your business.",
  },
  "pricing.monthly": {
    ar: "شهريًا",
    en: "Monthly",
  },
  "pricing.yearly": {
    ar: "سنويًا",
    en: "Yearly",
  },
  "pricing.yearlyBadge": {
    ar: "(وفر 20%)",
    en: "(Save 20%)",
  },
  "pricing.mostPopular": {
    ar: "الأكثر طلباً",
    en: "Most popular",
  },
  "pricing.currency": {
    ar: "ريال",
    en: "SAR",
  },
  "pricing.perMonth": {
    ar: "شهر",
    en: "month",
  },
  "pricing.perYear": {
    ar: "سنة",
    en: "year",
  },
  "pricing.choosePlan": {
    ar: "اختر الباقة",
    en: "Choose plan",
  },
  "pricing.note1": {
    ar: "تحليلان مجانيان للحساب بالكامل قبل الحاجة للاشتراك.",
    en: "Two full-account analyses for free before you need to subscribe.",
  },
  "pricing.note2": {
    ar: "يتم تجديد الاشتراك تلقائيًا باستخدام وسيلة الدفع المسجلة. يمكن إلغاء الاشتراك في أي وقت قبل موعد التجديد دون رسوم إضافية.",
    en: "Subscriptions renew automatically using your saved payment method. You can cancel anytime before renewal with no extra fees.",
  },
  "pricing.note3": {
    ar: "التوصيات إرشادية وتعتمد على البيانات المتاحة، ولا تمثل ضمانًا لنتائج أو أرباح.",
    en: "Recommendations are advisory and based on available data; they are not a guarantee of results or profits.",
  },
  "pricing.plan.starter.description": {
    ar: "للمتاجر الناشئة",
    en: "For new stores",
  },
  "pricing.plan.starter.feature1": {
    ar: "متجر واحد",
    en: "Single store",
  },
  "pricing.plan.starter.feature2": {
    ar: "ربط CSV (المنتجات والطلبات)",
    en: "CSV connection (products & orders)",
  },
  "pricing.plan.starter.feature3": {
    ar: "تقرير أساسي من بيانات متجرك",
    en: "Basic report from your store data",
  },
  "pricing.plan.starter.feature4": {
    ar: "مساعد ذكي يشرح لك وش تسوي (إرشادي)",
    en: "Guided AI assistant tailored to your store",
  },
  "pricing.plan.starter.feature5": {
    ar: "دعم عبر البريد",
    en: "Email support",
  },
  "pricing.plan.starter.notIncluded1": {
    ar: "توصيات الذكاء الاصطناعي",
    en: "AI-powered recommendations",
  },
  "pricing.plan.starter.notIncluded2": {
    ar: "تصدير البيانات",
    en: "Data export",
  },
  "pricing.plan.growth.description": {
    ar: "للمتاجر الطموحة",
    en: "For ambitious stores",
  },
  "pricing.plan.growth.feature1": {
    ar: "حتى 3 متاجر",
    en: "Up to 3 stores",
  },
  "pricing.plan.growth.feature2": {
    ar: "ربط CSV + جاهزية ربط سلة (عند توفر ربط التطبيق)",
    en: "CSV + ready for Salla connection (when available)",
  },
  "pricing.plan.growth.feature3": {
    ar: "تحديث يومي للبيانات (إذا كانت البيانات مرفوعة/مربوطة)",
    en: "Daily data refresh (when data is connected)",
  },
  "pricing.plan.growth.feature4": {
    ar: "توصيات ذكية موجهة لمتجرك (إرشادي + مبني على بياناتك)",
    en: "Smart recommendations tailored to your store",
  },
  "pricing.plan.growth.feature5": {
    ar: "أولوية دعم",
    en: "Priority support",
  },
  "pricing.plan.business.description": {
    ar: "للشركات الكبرى",
    en: "For larger companies",
  },
  "pricing.plan.business.feature1": {
    ar: "حتى 10 متاجر",
    en: "Up to 10 stores",
  },
  "pricing.plan.business.feature2": {
    ar: "تخصيص التقرير حسب نشاطك",
    en: "Customized report for your vertical",
  },
  "pricing.plan.business.feature3": {
    ar: "دعم مباشر",
    en: "Direct support",
  },
  "pricing.plan.business.feature4": {
    ar: "جلسة مراجعة شهرية",
    en: "Monthly review session",
  },
  "login.title": {
    ar: "تسجيل الدخول",
    en: "Log In",
  },
  "login.subtitle": {
    ar: "أدخل بريدك الإلكتروني للمتابعة",
    en: "Enter your email to continue",
  },
  "login.emailPlaceholder": {
    ar: "example@isaudi.ai",
    en: "example@isaudi.ai",
  },
  "login.sendCode": {
    ar: "إرسال رمز التحقق",
    en: "Send Verification Code",
  },
  "login.otpSent": {
    ar: "تم إرسال الرمز إلى",
    en: "Code sent to",
  },
  "login.otpPlaceholder": {
    ar: "أدخل الرمز (6 أرقام)",
    en: "Enter code (6 digits)",
  },
  "login.verify": {
    ar: "تأكيد الدخول",
    en: "Verify & Login",
  },
  "login.resend": {
    ar: "لم يصلك الرمز؟",
    en: "Didn't receive code?",
  },
  "login.back": {
    ar: "العودة",
    en: "Back",
  },
  "login.footerNote": {
    ar: "سنرسل لك رمز تحقق إلى بريدك الإلكتروني",
    en: "We will send a verification code to your email",
  },
  "login.error.invalidEmail": {
    ar: "البريد الإلكتروني غير صحيح",
    en: "Invalid email address",
  },
  "login.error.invalidOtp": {
    ar: "الرمز يجب أن يكون 6 أرقام",
    en: "Code must be 6 digits",
  },
  "login.error.invalidCode": {
    ar: "رمز التحقق غير صحيح",
    en: "Invalid code",
  },
  "login.error.generic": {
    ar: "حدث خطأ غير متوقع. حاول مرة أخرى.",
    en: "Something went wrong. Please try again.",
  },
  "dashboard.storeSetup.title": {
    ar: "إعداد المتجر",
    en: "Store setup",
  },
  "dashboard.storeSetup.description": {
    ar: "اختر منصة متجرك للبدء في التحليل",
    en: "Choose your store platform to start analysis",
  },
  "dashboard.storeSetup.sallaTitle": {
    ar: "ربط سلة (Salla)",
    en: "Connect Salla",
  },
  "dashboard.storeSetup.sallaSubtitle": {
    ar: "ربط مباشر وسريع",
    en: "Direct and fast integration",
  },
  "dashboard.storeSetup.csvTitle": {
    ar: "رفع ملف CSV",
    en: "Upload CSV file",
  },
  "dashboard.storeSetup.csvSubtitle": {
    ar: "للمتاجر الأخرى (Zid, Shopify)",
    en: "For other platforms (Zid, Shopify)",
  },
  "dashboard.storeSetup.note": {
    ar: "يمكنك تغيير الإعدادات لاحقاً من لوحة التحكم",
    en: "You can change these settings later from the dashboard",
  },
  "dashboard.generate.title": {
    ar: "تحليل متجرك جاهز للبدء",
    en: "Your store analysis is ready to start",
  },
  "dashboard.generate.description": {
    ar: "سيقوم نظام الذكاء الاصطناعي لدينا بتحليل بيانات متجرك وتقديم توصيات مخصصة لزيادة المبيعات وتحسين الأداء.",
    en: "Our AI system will analyze your store data and provide tailored recommendations to grow sales and improve performance.",
  },
  "dashboard.generate.freeLeft": {
    ar: "متبقي لديك {count} تحليل مجاني",
    en: "You have {count} free analysis remaining",
  },
  "dashboard.generate.loading": {
    ar: "جاري التحليل...",
    en: "Analyzing...",
  },
  "dashboard.generate.cta": {
    ar: "ابدأ التحليل الآن",
    en: "Start analysis now",
  },
  "dashboard.generate.upgrade": {
    ar: "الترقية للاستمرار",
    en: "Upgrade to continue",
  },
  "dashboard.chat.welcome": {
    ar: "أهلاً بك! أنا مساعدك الذكي المتخصص في التجارة الإلكترونية. لقد قمت بتحليل متجرك، كيف يمكنني مساعدتك اليوم؟",
    en: "Hi! I’m your smart assistant specialized in e-commerce. I’ve analyzed your store, how can I help today?",
  },
  "dashboard.chat.examples": {
    ar: "تقدر تسأل مثلاً:\n- وش أكثر المنتجات ربحية؟\n- وش أركز عليه هالأسبوع؟\n- هل إعلاناتي مربحة؟\n- كيف أقدر أحسن الهامش الربحي؟",
    en: "For example, you can ask:\n- Which products are most profitable?\n- What should I focus on this week?\n- Are my ads profitable?\n- How can I improve my margins?",
  },
  "dashboard.chat.assistantLabel": {
    ar: "المساعد",
    en: "Assistant",
  },
  "dashboard.chat.userLabel": {
    ar: "أنت",
    en: "You",
  },
  "dashboard.chat.placeholder": {
    ar: "اسأل عن أداء متجرك، المنتجات، أو فرص التحسين...",
    en: "Ask about your store performance, products, or improvement opportunities...",
  },
  "dashboard.chat.error": {
    ar: "عذراً، حدث خطأ أثناء المعالجة. يرجى المحاولة مرة أخرى.",
    en: "Sorry, something went wrong. Please try again.",
  },
  "dashboard.chat.title": {
    ar: "المساعد الذكي",
    en: "Smart assistant",
  },
  "dashboard.chat.subtitle": {
    ar: "متخصص في التجارة الإلكترونية السعودية",
    en: "Specialized in Saudi e-commerce",
  },
  "dashboard.chat.blocked.prefix": {
    ar: "لقد استهلكت رصيدك المجاني.",
    en: "You have used your free quota.",
  },
  "dashboard.chat.blocked.cta": {
    ar: "اشترك الآن",
    en: "Subscribe now",
  },
  "dashboard.chat.blocked.suffix": {
    ar: "للمتابعة.",
    en: "to continue.",
  },
  "dashboard.insights.error.weeklyLoad": {
    ar: "تعذر تحميل البيانات الأسبوعية.",
    en: "Failed to load weekly data.",
  },
  "dashboard.insights.error.noWeekly": {
    ar: "لا توجد ملخصات أسبوعية بعد.",
    en: "No weekly summaries yet.",
  },
  "dashboard.insights.error.paidOnly": {
    ar: "الميزة متاحة في الخطط المدفوعة.",
    en: "This feature is available on paid plans.",
  },
  "dashboard.insights.error.smartSummary": {
    ar: "تعذر تحميل الملخص الذكي.",
    en: "Failed to load smart summary.",
  },
  "dashboard.insights.productProfitLine": {
    ar: "– ربح {profit} SAR، هامش {margin}%",
    en: "– Profit {profit} SAR, margin {margin}%",
  },
  "dashboard.dev.modeTitle": {
    ar: "وضع التطوير",
    en: "Development mode",
  },
  "dashboard.dev.currentPlan": {
    ar: "الخطة الحالية:",
    en: "Current plan:",
  },
  "dashboard.costs.enterNow": {
    ar: "إدخال التكاليف الآن",
    en: "Enter costs now",
  },
  "dashboard.freeBanner.text": {
    ar: "متبقي لديك {count} تحليل مجاني (من 2)",
    en: "You have {count} free analysis remaining (out of 2)",
  },
  "dashboard.freeBanner.button": {
    ar: "ارفع CSV وشغل التحليل",
    en: "Upload CSV and run analysis",
  },
  "dashboard.reportView.executiveSummary.fallback": {
    ar: "تم إنشاء تحليل مبني على بياناتك.",
    en: "An analysis has been generated based on your data.",
  },
  "dashboard.reportView.metrics.totalSales": {
    ar: "إجمالي المبيعات",
    en: "Total sales",
  },
  "dashboard.reportView.metrics.totalOrders": {
    ar: "إجمالي الطلبات",
    en: "Total orders",
  },
  "dashboard.reportView.metrics.avgOrderValue": {
    ar: "قيمة الطلب المتوسطة",
    en: "Average order value",
  },
  "dashboard.reportView.metrics.excluded": {
    ar: "تم استبعاد {orders} طلبات ملغاة/محذوفة بمجموع {amount} SAR من التحليلات.",
    en: "Excluded {orders} cancelled/removed orders totalling {amount} SAR from analysis.",
  },
  "dashboard.reportView.executiveSummary.title": {
    ar: "الملخص التنفيذي",
    en: "Executive summary",
  },
  "dashboard.reportView.topProducts.title": {
    ar: "أفضل المنتجات أداءً",
    en: "Top performing products",
  },
  "dashboard.reportView.topProducts.defaultName": {
    ar: "منتج",
    en: "Product",
  },
  "dashboard.reportView.topProducts.meta": {
    ar: " — {revenue} SAR • {qty} قطعة",
    en: " — {revenue} SAR • {qty} units",
  },
  "dashboard.reportView.weakProducts.title": {
    ar: "منتجات تحتاج تحسين",
    en: "Products needing improvement",
  },
  "dashboard.reportView.weakProducts.defaultName": {
    ar: "منتج",
    en: "Product",
  },
  "dashboard.reportView.weakProducts.meta": {
    ar: " — {revenue} SAR • {qty} قطعة",
    en: " — {revenue} SAR • {qty} units",
  },
  "dashboard.reportView.profitability.title": {
    ar: "الربحية",
    en: "Profitability",
  },
  "dashboard.reportView.profitability.totalProfit": {
    ar: "إجمالي الربح",
    en: "Total profit",
  },
  "dashboard.reportView.profitability.margin": {
    ar: "هامش الربح",
    en: "Profit margin",
  },
  "dashboard.reportView.profitability.incomplete": {
    ar: "تكاليف غير مكتملة",
    en: "Incomplete costs",
  },
  "dashboard.reportView.profitability.incompleteSummary": {
    ar: "منتجات بدون تكاليف: {products} • مبيعات غير محسوبة: {sales} SAR",
    en: "Products without costs: {products} • Unaccounted sales: {sales} SAR",
  },
  "dashboard.reportView.profitability.none": {
    ar: "لا يوجد",
    en: "None",
  },
  "dashboard.reportView.profitability.topProfit": {
    ar: "أفضل المنتجات ربحًا",
    en: "Most profitable products",
  },
  "dashboard.reportView.profitability.worstMargins": {
    ar: "أسوأ هوامش",
    en: "Worst margins",
  },
  "dashboard.reportView.conversion.title": {
    ar: "معدل التحويل",
    en: "Conversion rate",
  },
  "dashboard.reportView.conversion.noData": {
    ar: "نحتاج بيانات زيارات (GA4) لقياس التحويل بدقة. طبّق تحسينات تجربة المستخدم.",
    en: "We need traffic data (GA4) to measure conversion accurately. Apply UX improvements.",
  },
  "dashboard.reportView.pricing.title": {
    ar: "اقتراحات التسعير",
    en: "Pricing suggestions",
  },
  "dashboard.reportView.pricing.noData": {
    ar: "لا توجد اقتراحات تسعير محددة حاليًا.",
    en: "There are no specific pricing suggestions at the moment.",
  },
  "dashboard.reportView.growth.title": {
    ar: "فرص النمو",
    en: "Growth opportunities",
  },
  "dashboard.reportView.growth.noData": {
    ar: "لا توجد فرص نمو محددة حالياً.",
    en: "There are no specific growth opportunities at the moment.",
  },
  "meta.title": {
    ar: "isaudi.ai - ذكاء اصطناعي يحلل متجرك",
    en: "isaudi.ai - AI that analyzes your store",
  },
  "meta.description": {
    ar: "منصة ذكاء اصطناعي تحلل المتاجر السعودية وتعطيك خطة واضحة لزيادة المبيعات",
    en: "An AI platform that analyzes Saudi stores and gives you a clear plan to grow sales",
  },
  "header.nav.pricing": {
    ar: "الأسعار",
    en: "Pricing",
  },
  "header.nav.how": {
    ar: "كيف يعمل",
    en: "How it works",
  },
  "header.lang.toggle": {
    ar: "English",
    en: "عربي",
  },
  "header.logout": {
    ar: "تسجيل الخروج",
    en: "Log Out",
  },
  "header.login": {
    ar: "تسجيل الدخول",
    en: "Log In",
  },
  "footer.tagline": {
    ar: "منصة الذكاء الاصطناعي الأولى لتحليل وتطوير المتاجر الإلكترونية في السعودية.",
    en: "The first AI platform to analyze and grow Saudi online stores.",
  },
  "footer.column.product": {
    ar: "المنتج",
    en: "Product",
  },
  "footer.column.company": {
    ar: "الشركة",
    en: "Company",
  },
  "footer.column.legal": {
    ar: "قانوني",
    en: "Legal",
  },
  "footer.link.features": {
    ar: "المميزات",
    en: "Features",
  },
  "footer.link.pricing": {
    ar: "الأسعار",
    en: "Pricing",
  },
  "footer.link.howItWorks": {
    ar: "كيف يعمل",
    en: "How it works",
  },
  "footer.link.stories": {
    ar: "قصص النجاح",
    en: "Success stories",
  },
  "footer.link.about": {
    ar: "عن isaudi",
    en: "About isaudi",
  },
  "footer.link.jobs": {
    ar: "الوظائف",
    en: "Jobs",
  },
  "footer.link.contact": {
    ar: "تواصل معنا",
    en: "Contact us",
  },
  "footer.link.blog": {
    ar: "المدونة",
    en: "Blog",
  },
  "footer.link.terms": {
    ar: "الشروط والأحكام",
    en: "Terms & conditions",
  },
  "footer.link.privacy": {
    ar: "سياسة الخصوصية",
    en: "Privacy policy",
  },
  "footer.link.usage": {
    ar: "سياسة الاستخدام",
    en: "Usage policy",
  },
  "footer.cr.imageAlt": {
    ar: "السجل التجاري",
    en: "Commercial register",
  },
  "footer.cr.label": {
    ar: "السجل التجاري",
    en: "Commercial register",
  },
  "footer.rights": {
    ar: "جميع الحقوق محفوظة.",
    en: "All rights reserved.",
  },
};

export function t(lang: Lang, key: string): string {
  const entry = translations[key];
  if (!entry) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`Missing translation for key: ${key}`);
    }
    return key;
  }
  return lang === "en" ? entry.en : entry.ar;
}

export function createTranslator(lang: Lang) {
  return (key: string) => t(lang, key);
}
