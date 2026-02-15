"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Globe, LogOut } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { useRouter } from "next/navigation";
import { createTranslator } from "@/lib/i18n/translations";

interface HeaderProps {
  userEmail?: string;
}

export function Header({ userEmail }: HeaderProps) {
  const { toggleLanguage, lang } = useLanguage();
  const router = useRouter();
  const t = createTranslator(lang);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <Container>
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="relative w-8 h-8 md:w-10 md:h-10">
                 <Image 
                  src="/logo.png" 
                  alt="isaudi.ai Logo" 
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-isaudi-green-dark to-isaudi-green">
                isaudi.ai
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6 mr-8">
              <Link href="#pricing" className="text-sm font-medium text-gray-600 hover:text-isaudi-green transition-colors">
                {t("header.nav.pricing")}
              </Link>
              <Link href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-isaudi-green transition-colors">
                {t("header.nav.how")}
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
             <Button 
              variant="ghost" 
              size="sm" 
              className="hidden md:flex gap-2 text-gray-600"
              onClick={toggleLanguage}
            >
              <Globe className="w-4 h-4" />
              <span>{t("header.lang.toggle")}</span>
            </Button>
            
            {userEmail ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 hidden md:inline-block">
                  {userEmail}
                </span>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleLogout}
                  className="text-gray-600 hover:text-red-600 hover:bg-red-50 border-gray-200"
                >
                  <LogOut className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">
                    {t("header.logout")}
                  </span>
                </Button>
              </div>
            ) : (
              <Link href="/login">
                <Button size="sm" className="bg-isaudi-green hover:bg-isaudi-green-dark text-white shadow-sm hover:shadow-md transition-all">
                  {t("header.login")}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </Container>
    </header>
  );
}
