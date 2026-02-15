import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "isaudi.ai",
};

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 leading-8 text-slate-900">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          عن isaudi.ai
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          آخر تحديث: 2026-02-13
        </p>
      </div>

      <div className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-a:text-emerald-700">
        
<p>
isaudi.ai منصة تحليل وتوصيات تساعد المتاجر الإلكترونية داخل السعودية على فهم الأداء واتخاذ قرارات أوضح باستخدام أدوات تحليل وتقارير ومساعد ذكي.
</p>

<h2>ماذا نقدم اليوم</h2>
<ul>
  <li>رفع بيانات عبر CSV (مثل المنتجات والطلبات) للحصول على تقرير أساسي.</li>
  <li>مساعد ذكي يشرح لك الأرقام ويقترح خطوات عملية بناءً على البيانات المتاحة.</li>
  <li>تطوير تدريجي لميزات الربط المباشر حسب توفر التكاملات الرسمية.</li>
</ul>

<h2>بيانات الشركة</h2>
<ul>
  <li><strong>السجل التجاري</strong>: 7050191290</li>
  <li><strong>البريد</strong>: info@isaudi.ai</li>
</ul>

      </div>
    </main>
  );
}
