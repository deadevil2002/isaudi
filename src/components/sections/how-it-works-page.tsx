"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  CalendarCheck,
  ChartNoAxesCombined,
  FileSpreadsheet,
  GitCompareArrows,
  PlugZap,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

export function HowItWorksPageContent() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  const steps = [
    { icon: PlugZap, title: t("howPage.step1.title"), description: t("howPage.step1.description") },
    { icon: FileSpreadsheet, title: t("howPage.step2.title"), description: t("howPage.step2.description") },
    { icon: ChartNoAxesCombined, title: t("howPage.step3.title"), description: t("howPage.step3.description") },
    { icon: Sparkles, title: t("howPage.step4.title"), description: t("howPage.step4.description") },
    { icon: CalendarCheck, title: t("howPage.step5.title"), description: t("howPage.step5.description") },
  ];

  const details = [
    { icon: ReceiptText, title: t("howPage.costs.title"), description: t("howPage.costs.description") },
    { icon: GitCompareArrows, title: t("howPage.reports.title"), description: t("howPage.reports.description") },
    { icon: Bot, title: t("howPage.ai.title"), description: t("howPage.ai.description") },
  ];

  return (
    <>
      <section className="overflow-hidden bg-gradient-to-b from-isaudi-green/5 to-white pb-16 pt-16 md:pb-24 md:pt-24">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-sm font-bold text-isaudi-green">{t("howPage.eyebrow")}</p>
            <h1 className="text-3xl font-bold leading-tight text-gray-950 md:text-5xl">
              {t("howPage.title")}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-gray-600 md:text-lg">
              {t("howPage.subtitle")}
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-white py-16 md:py-24">
        <Container>
          <ol className="mx-auto grid max-w-6xl gap-5 md:grid-cols-5">
            {steps.map(({ icon: Icon, title, description }, index) => (
              <li
                key={title}
                className="relative rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-isaudi-green/10 text-isaudi-green">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold text-gray-300">
                    {new Intl.NumberFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
                      minimumIntegerDigits: 2,
                    }).format(index + 1)}
                  </span>
                </div>
                <h2 className="text-base font-bold leading-7 text-gray-950">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="bg-gray-50 py-16 md:py-24">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-gray-950 md:text-4xl">
              {t("howPage.details.title")}
            </h2>
            <p className="mt-4 leading-7 text-gray-600">{t("howPage.details.subtitle")}</p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
            {details.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-isaudi-green/10 text-isaudi-green">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-gray-950">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-gray-600">{description}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-white py-16 md:py-24">
        <Container>
          <div className="mx-auto max-w-4xl rounded-3xl bg-gray-950 px-6 py-10 text-center text-white shadow-xl md:px-12 md:py-14">
            <h2 className="text-2xl font-bold md:text-3xl">{t("howPage.cta.title")}</h2>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-gray-300">{t("howPage.cta.description")}</p>
            <Button asChild className="mt-7 min-h-12 bg-isaudi-green px-6 text-white hover:bg-isaudi-green-dark">
              <Link href="/login">
                {t("howPage.cta.action")}
                <ArrowLeft className={cn("h-4 w-4", lang === "en" && "rotate-180")} />
              </Link>
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}