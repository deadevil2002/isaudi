"use client";

import Link from "next/link";
import { Languages, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";

type LegalPolicyKind = "privacy" | "terms";
type PolicyCopy = { title: string; updated: string; intro: string; sections: readonly (readonly [string, readonly string[]])[] };

const privacy: Record<"ar" | "en", PolicyCopy> = {
  ar: {
    title: "سياسة الخصوصية", updated: "آخر تحديث: 3 أكتوبر 2026",
    intro: "توضح هذه السياسة، بلغة مبسطة، البيانات التي تعالجها iSaudi ولماذا وكيف نحميها.",
    sections: [
      ["البيانات التي نعالجها", ["بيانات الحساب مثل البريد الإلكتروني وبيانات التحقق.", "بيانات المتجر التي تربطها أو ترفعها، ومنها المنتجات والطلبات والتكاليف والتقارير. قد تتضمن استجابات مزود المتجر أو الملفات المرفوعة بيانات عن عملاء متجرك؛ نتجاهل الحقول غير اللازمة للتحليل ولا نسمح بهوياتهم المباشرة في الذكاء المشترك.", "بيانات الاستخدام والأمان اللازمة لتشغيل الخدمة وحمايتها وتشخيص الأخطاء."]],
      ["أغراض المعالجة", ["تشغيل الخدمة وتقديم التحليلات والتقارير والتوصيات.", "إدارة الحساب والاشتراك والدعم والأمان ومنع إساءة الاستخدام.", "تحسين جودة التحليلات والتوصيات على النحو الموضح أدناه."]],
      ["تحسين التحليلات والتوصيات", ["قد نستخدم مؤشرات ونتائج مجمعة ومزالة معرّفات المصدر، مشتقة آليًا من استخدامك لخدمات iSaudi، لتحسين التحليلات واكتشاف الأنماط العامة وتقديم توصيات أفضل مستقبلًا.", "لا نعرض للعملاء الآخرين بيانات متجرك أو هويتك أو سجلاتك الخام. ولا نستخدم هذا المسار لتدريب نموذج ذكاء اصطناعي على سجلات متجرك الخام.", "قد تُمرر أدلة موجزة ومعتمدة عن نمط عام إلى مزود الذكاء الاصطناعي ضمن طلب التحليل الحالي؛ ولا تتضمن هذه الأدلة هوية أو سجلات خام أو روابط أو قيمًا مالية دقيقة لمتاجر المصدر.", "هذه المعالجة غير مفعلة حاليًا لعملاء الإنتاج، ولن تُفعّل قبل اعتماد أساسها النظامي وضوابطها القانونية."]],
      ["الأساس النظامي وموقع المعالجة", ["تتم معالجة الحساب وتشغيل الوظائف التي تطلبها والأمن والالتزامات النظامية وفق الأساس النظامي الملائم لكل نشاط. أما الغرض الإضافي للذكاء المشترك فما زال قيد المراجعة القانونية قبل تفعيله.", "قد يعمل بعض مقدمي الخدمة من خارج المملكة. عندما تنطبق أحكام نقل البيانات، يلزم استكمال تقييم النقل والضمانات النظامية المناسبة. لن تُرسل أدلة الذكاء المشترك قبل حسم هذا التقييم."]],
      ["المشاركة ومقدمو الخدمة", ["لا نبيع بياناتك ولا نشاركها لأغراض تسويقية.", "قد نعالج الحد الأدنى اللازم عبر مزودي الاستضافة وقواعد البيانات والبريد والدفع والذكاء الاصطناعي لتقديم الوظيفة التي طلبتها، أو استجابةً لطلب نظامي ملزم."]],
      ["الاحتفاظ والحذف", ["لا نمدد احتفاظ السجلات الخام لمجرد تحسين التحليلات. نحتفظ بالبيانات بقدر الحاجة لتقديم الخدمة والوفاء بالمتطلبات النظامية.", "عند حذف بيانات العميل، تُزال المساهمات الخاصة المرتبطة به وتُعاد حساب المجاميع المتأثرة وتُوقف الأنماط التي لم تعد تستوفي ضوابطها، ما لم يوجد التزام نظامي موثق يقتضي خلاف ذلك."]],
      ["حقوقك وخياراتك", ["يمكنك طلب الوصول أو التصحيح أو الحذف وفق الأنظمة والقيود النظامية السارية.", "الأساس النظامي الدقيق وآلية الاعتراض أو الانسحاب الخاصة بالذكاء المشترك قيد مراجعة قانونية قبل تفعيل هذه المعالجة للعملاء في الإنتاج؛ لا نضيف موافقة شكلية أو ندّعي حقًا غير مقرر."]],
      ["الأمن وملفات الارتباط", ["نطبق ضوابط وصول وعزل للعملاء وإجراءات أمنية لحماية البيانات.", "قد نستخدم ملفات ارتباط ضرورية للجلسة والأمان والتفضيلات؛ ويمكن التحكم بغير الضروري منها من إعدادات المتصفح حيث ينطبق."]],
      ["التحديثات والتواصل", ["قد نحدّث هذه السياسة عند تغير الخدمة أو المتطلبات. سنعرض تاريخ النسخة المحدثة.", "للاستفسارات والطلبات: info@isaudi.ai — السجل التجاري: 7050191290."]],
    ],
  },
  en: {
    title: "Privacy Notice", updated: "Last updated: 3 October 2026",
    intro: "This notice explains, in plain language, what data iSaudi processes, why we process it, and how we protect it.",
    sections: [
      ["Data we process", ["Account data such as your email address and verification records.", "Store data you connect or upload, including products, orders, costs, and reports. Provider responses or uploaded files may contain information about your store's customers; fields not needed for analytics are discarded and direct customer identity is not permitted in shared intelligence.", "Usage and security data needed to operate and protect the service and diagnose errors."]],
      ["Why we process data", ["To operate the service and provide analytics, reports, and recommendations.", "To manage accounts, subscriptions, support, security, and abuse prevention.", "To improve analytics and recommendations as described below."]],
      ["Analytics and recommendation improvement", ["We may use aggregated indicators with source identifiers removed, derived automatically from your use of iSaudi, to improve analytics, identify general patterns, and provide better recommendations over time.", "We do not expose your store data, identity, or raw records to other customers. This process does not train an AI model on your store's raw records.", "A compact, approved description of a general pattern may be included in the current AI analysis request. It does not contain source identity, raw records, URLs, or exact financial values from source stores.", "This processing is not currently enabled for production customers and will not be enabled before its lawful basis and legal safeguards are approved."]],
      ["Lawful basis and processing location", ["Account processing, requested service functions, security, and legal obligations use the basis applicable to each recorded activity. The separate lawful basis for shared intelligence remains under legal review before activation.", "Some service providers may operate outside Saudi Arabia. Where transfer rules apply, a transfer assessment and appropriate legal safeguard must be completed. Shared-intelligence evidence will not be sent before that assessment is resolved."]],
      ["Sharing and service providers", ["We do not sell your data or share it for third-party marketing.", "We may process the minimum necessary data through hosting, database, email, payment, and AI providers to deliver a function you request, or in response to a binding lawful request."]],
      ["Retention and deletion", ["We do not extend raw-record retention merely to improve analytics. We retain data only as needed to provide the service and meet applicable legal requirements.", "When customer data is deleted, related private contributions are removed, affected aggregates are recomputed, and patterns that no longer pass their safeguards are suppressed, unless a documented legal obligation requires otherwise."]],
      ["Your rights and choices", ["You may request access, correction, or deletion subject to applicable law and lawful limitations.", "The precise lawful basis and any objection or opt-out mechanism for shared intelligence require legal review before this processing is activated for production customers. We do not add a cosmetic consent or claim a right that has not been established."]],
      ["Security and cookies", ["We apply access controls, tenant isolation, and security measures designed to protect data.", "We may use cookies necessary for sessions, security, and preferences; non-essential cookies can be controlled through browser settings where applicable."]],
      ["Updates and contact", ["We may update this notice when the service or requirements change. The current version date will be shown here.", "Questions and requests: info@isaudi.ai — Commercial registration: 7050191290."]],
    ],
  },
};

const terms: Record<"ar" | "en", PolicyCopy> = {
  ar: {
    title: "الشروط والأحكام", updated: "آخر تحديث: 3 أكتوبر 2026",
    intro: "تنظم هذه الشروط استخدام منصة iSaudi وخدمات تحليل بيانات المتاجر الإلكترونية.",
    sections: [
      ["الخدمة والمخرجات", ["تقدم iSaudi أدوات تحليل وتقارير ومقارنات وتوصيات ومساعدًا ذكيًا بناءً على البيانات المتاحة.", "المخرجات إرشادية وليست استشارة مالية أو قانونية أو ضريبية، ولا تضمن نتيجة أو ربحًا."]],
      ["مسؤولية المستخدم", ["أنت مسؤول عن دقة البيانات التي تربطها أو ترفعها وعن امتلاكك الحق النظامي في استخدامها.", "يحظر رفع بيانات الغير دون تفويض أو استخدام الخدمة بصورة تضر بالمنصة أو تخالف الأنظمة."]],
      ["تحسين الخدمة والخصوصية", ["قد تستخدم iSaudi مؤشرات مجمعة ومزالة معرّفات المصدر لتحسين التحليلات واكتشاف الأنماط العامة، وفق سياسة الخصوصية وضوابطها وبعد اعتماد الأساس النظامي قبل التفعيل.", "لا تمنح هذه الشروط وحدها iSaudi أساسًا لمعالجة البيانات الشخصية لغرض إضافي، ولا حق عرض بيانات متجرك أو هويتك أو سجلاتك الخام لعملاء آخرين. راجع سياسة الخصوصية للتفاصيل."]],
      ["الاشتراكات والدفع", ["توضح صفحة الأسعار المزايا والأسعار. يبدأ الخصم بعد اختيار باقة مدفوعة وتأكيد الدفع.", "يمكن إلغاء التجديد قبل موعده؛ ويستمر الوصول عادةً حتى نهاية الفترة المدفوعة. تخضع معالجة الاسترداد للأنظمة السارية وطبيعة الخدمة المنفذة."]],
      ["التوفر والملكية الفكرية", ["قد تحدث توقفات للصيانة أو لأسباب خارجة عن السيطرة، وقد نقيد ميزة مؤقتًا لحماية الخدمة.", "المنصة وتصميمها وبرمجياتها وعلامتها مملوكة لـ iSaudi أو مرخصة لها، ولا يجوز نسخها أو إعادة بيعها بالمخالفة للحقوق."]],
      ["التعديلات والقانون والتواصل", ["قد نحدّث الشروط عند تغير الخدمة أو المتطلبات، وسنعرض تاريخ النسخة الحالية.", "تخضع الشروط لأنظمة المملكة العربية السعودية. للتواصل: info@isaudi.ai — السجل التجاري: 7050191290."]],
    ],
  },
  en: {
    title: "Terms of Service", updated: "Last updated: 3 October 2026",
    intro: "These terms govern use of iSaudi and its e-commerce store analytics services.",
    sections: [
      ["Service and outputs", ["iSaudi provides analytics, reports, comparisons, recommendations, and an AI assistant based on available data.", "Outputs are informational, not financial, legal, tax, or investment advice, and do not guarantee an outcome or profit."]],
      ["Your responsibilities", ["You are responsible for the accuracy of data you connect or upload and for having the lawful right to use it.", "You must not upload another party's data without authority or use the service in a way that harms the platform or violates applicable law."]],
      ["Service improvement and privacy", ["iSaudi may use aggregated indicators with source identifiers removed to improve analytics and identify general patterns, subject to the Privacy Notice, its safeguards, and approval of the lawful basis before activation.", "These terms alone do not establish a lawful basis for an additional personal-data purpose and do not permit iSaudi to expose your store data, identity, or raw records to other customers. See the Privacy Notice for details."]],
      ["Subscriptions and payments", ["Features and prices are shown on the pricing page. Charges begin only after you select a paid plan and confirm payment.", "You may cancel renewal before its due date; access normally continues to the end of the paid period. Refund handling remains subject to applicable law and the nature of services already performed."]],
      ["Availability and intellectual property", ["Maintenance or events outside our control may cause interruptions, and a feature may be temporarily restricted to protect the service.", "The platform, design, software, and brand are owned by or licensed to iSaudi and may not be copied or resold in violation of those rights."]],
      ["Changes, governing law, and contact", ["We may update these terms when the service or requirements change and will show the current version date.", "These terms are governed by the laws of Saudi Arabia. Contact: info@isaudi.ai — Commercial registration: 7050191290."]],
    ],
  },
};

export function LegalPolicyPage({ kind }: { kind: LegalPolicyKind }) {
  const { lang, toggleLanguage } = useLanguage();
  const copy = (kind === "privacy" ? privacy : terms)[lang];
  return (
    <main className="isaudi-grid-bg min-h-screen bg-[#06090c] px-4 py-10 text-white sm:px-6 sm:py-16" dir={lang === "ar" ? "rtl" : "ltr"}>
      <article className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0e1218]/95 shadow-[0_30px_90px_rgba(0,0,0,.38)]">
        <header className="relative border-b border-white/10 px-5 py-8 sm:px-10 sm:py-10">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e6b95c] to-transparent" />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><span className="mb-4 grid h-11 w-11 place-items-center rounded-xl border border-[#0fc9a7]/20 bg-[#0fc9a7]/10 text-[#0fc9a7]"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{copy.title}</h1><p className="mt-3 text-sm text-[#94a3b8]">{copy.updated}</p><p className="mt-5 max-w-2xl text-base leading-8 text-[#cbd5e1]">{copy.intro}</p></div>
            <button type="button" onClick={toggleLanguage} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 text-sm font-semibold text-white transition-colors hover:border-[#e6b95c]/40 hover:bg-[#e6b95c]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6b95c]"><Languages className="h-4 w-4" aria-hidden="true" />{lang === "ar" ? "English" : "العربية"}</button>
          </div>
        </header>
        <div className="space-y-8 px-5 py-8 sm:px-10 sm:py-10">
          {copy.sections.map(([heading, items]) => <section key={heading} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-5 sm:p-6"><h2 className="text-xl font-bold text-[#f4d58d]">{heading}</h2><ul className="mt-4 space-y-3 text-sm leading-7 text-[#b9c4d3] sm:text-base">{items.map((item) => <li key={item} className="flex gap-3"><span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0fc9a7]" /><span>{item}</span></li>)}</ul></section>)}
          <nav className="flex flex-wrap gap-3 border-t border-white/10 pt-6 text-sm"><Link href="/" className="rounded-xl border border-white/10 px-4 py-2.5 text-[#cbd5e1] hover:border-[#0fc9a7]/40 hover:text-white">{lang === "ar" ? "الرئيسية" : "Home"}</Link><Link href={kind === "privacy" ? "/terms" : "/privacy"} className="rounded-xl border border-[#e6b95c]/25 bg-[#e6b95c]/10 px-4 py-2.5 text-[#f4d58d]">{kind === "privacy" ? (lang === "ar" ? "الشروط والأحكام" : "Terms of Service") : (lang === "ar" ? "سياسة الخصوصية" : "Privacy Notice")}</Link></nav>
        </div>
      </article>
    </main>
  );
}
