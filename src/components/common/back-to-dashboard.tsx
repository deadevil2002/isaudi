"use client";

import Link from "next/link";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

export function BackToDashboardLink() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  return (
    <Link href="/dashboard" className="text-sm text-isaudi-green">
      {t("reports.backToDashboard")}
    </Link>
  );
}

