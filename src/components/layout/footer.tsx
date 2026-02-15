"use client";

import { Container } from "@/components/ui/container";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

export function Footer() {
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-8" id="contact">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="relative w-8 h-8">
                 <Image 
                  src="/logo.png" 
                  alt="isaudi.ai Logo" 
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-bold text-gray-900">
                isaudi.ai
              </span>
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-bold text-gray-900 mb-4">
              {t("footer.column.product")}
            </h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>
                <Link href="#features" className="hover:text-isaudi-green transition-colors">
                  {t("footer.link.features")}
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="hover:text-isaudi-green transition-colors">
                  {t("footer.link.pricing")}
                </Link>
              </li>
              <li>
                <Link href="#how-it-works" className="hover:text-isaudi-green transition-colors">
                  {t("footer.link.howItWorks")}
                </Link>
              </li>
              <li>
                <Link href="/stories" className="hover:text-isaudi-green transition-colors">
                  {t("footer.link.stories")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 mb-4">
              {t("footer.column.company")}
            </h4>
            <ul className="space-y-2 text-sm text-gray-500 mb-6">
              <li>
                <Link href="/about" className="hover:text-isaudi-green transition-colors">
                  {t("footer.link.about")}
                </Link>
              </li>
              <li>
                <Link href="/jobs" className="hover:text-isaudi-green transition-colors">
                  {t("footer.link.jobs")}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-isaudi-green transition-colors">
                  {t("footer.link.contact")}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-isaudi-green transition-colors">
                  {t("footer.link.blog")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 mb-4">
              {t("footer.column.legal")}
            </h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>
                <Link href="/terms" className="hover:text-isaudi-green transition-colors">
                  {t("footer.link.terms")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-isaudi-green transition-colors">
                  {t("footer.link.privacy")}
                </Link>
              </li>
              <li>
                <Link href="/usage" className="hover:text-isaudi-green transition-colors">
                  {t("footer.link.usage")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Ministry of Commerce Commercial Register - Full Width Centered */}
        <div className="w-full flex justify-center items-center mt-10 mb-[30px]">
           <div className="max-w-[280px] w-full bg-white rounded-xl py-[25px] px-4 text-center shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] border border-gray-50 flex flex-col items-center">
               <div className="relative w-[110px] h-[40px] mb-[15px]">
                   <Image 
                     src="/images/commercial-register.avif" 
                     alt={t("footer.cr.imageAlt")} 
                     fill 
                     className="object-contain"
                   />
               </div>
               <div className="text-[#111]">
                  <span className="block text-sm font-medium mb-1">
                    {t("footer.cr.label")}
                  </span>
                  <span className="block font-mono text-base font-bold tracking-wide">7050191290</span>
               </div>
            </div>
        </div>

        <div className="pt-8 border-t border-gray-100 text-center text-sm text-gray-400">
          <p>
            © {new Date().getFullYear()} isaudi.ai. {t("footer.rights")}
          </p>
        </div>
      </Container>
    </footer>
  );
}
