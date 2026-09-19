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
    <footer className="bg-[#06090c] border-t border-white/10 pt-16 pb-8 text-[#94a3b8]" id="contact">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="flex items-center mb-6">
              <div className="relative w-32 h-10">
                 <Image
                  src="/brand/design-preview-logo.png"
                  alt="iSaudi.ai Logo"
                  fill
                  className="object-contain"
                />
              </div>
            </Link>
            <p className="text-sm leading-relaxed text-[#94a3b8]">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-bold text-white mb-4">
              {t("footer.column.product")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/#features" className="hover:text-white transition-colors">
                  {t("footer.link.features")}
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="hover:text-white transition-colors">
                  {t("footer.link.pricing")}
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-white transition-colors">
                  {t("footer.link.howItWorks")}
                </Link>
              </li>
              <li>
                <Link href="/stories" className="hover:text-white transition-colors">
                  {t("footer.link.stories")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">
              {t("footer.column.company")}
            </h4>
            <ul className="space-y-2 text-sm mb-6">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  {t("footer.link.about")}
                </Link>
              </li>
              <li>
                <Link href="/jobs" className="hover:text-white transition-colors">
                  {t("footer.link.jobs")}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  {t("footer.link.contact")}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-white transition-colors">
                  {t("footer.link.blog")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">
              {t("footer.column.legal")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  {t("footer.link.terms")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  {t("footer.link.privacy")}
                </Link>
              </li>
              <li>
                <Link href="/usage" className="hover:text-white transition-colors">
                  {t("footer.link.usage")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Ministry of Commerce Commercial Register - Full Width Centered */}
        <div className="w-full flex justify-center items-center mt-10 mb-[30px]">
           <div className="max-w-[280px] w-full bg-[#161c24] rounded-xl py-[25px] px-4 text-center border border-white/10 flex flex-col items-center">
               <div className="relative w-[110px] h-[40px] mb-[15px] opacity-80 mix-blend-screen bg-white rounded-md">
                   <Image 
                     src="/images/commercial-register.avif" 
                     alt={t("footer.cr.imageAlt")} 
                     fill 
                     className="object-contain"
                   />
               </div>
               <div className="text-white">
                  <span className="block text-sm font-medium mb-1">
                    {t("footer.cr.label")}
                  </span>
                  <span className="block font-mono text-base font-bold tracking-wide text-[#e6b95c]">7050191290</span>
               </div>
            </div>
        </div>

        <div className="pt-8 border-t border-white/10 text-center text-sm">
          <p>
            © {new Date().getFullYear()} isaudi.ai. {t("footer.rights")}
          </p>
        </div>
      </Container>
    </footer>
  );
}
