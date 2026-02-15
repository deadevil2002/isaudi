import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "isaudi.ai",
};

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 leading-8 text-slate-900">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          الوظائف
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          آخر تحديث: 2026-02-13
        </p>
      </div>

      <div className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-a:text-emerald-700">
        
<p>
هذه صفحة الوظائف. عند توفر فرص عمل سيتم نشرها هنا.
</p>

      </div>
    </main>
  );
}
