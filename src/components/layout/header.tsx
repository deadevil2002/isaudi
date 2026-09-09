"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Globe, LogOut, Menu, X, LayoutDashboard, TrendingUp, ShoppingBag, Settings, CreditCard } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { useRouter } from "next/navigation";
import { createTranslator } from "@/lib/i18n/translations";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  userEmail?: string;
}

export function Header({ userEmail }: HeaderProps) {
  const { toggleLanguage, lang } = useLanguage();
  const router = useRouter();
  const t = createTranslator(lang);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on resize to md
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <Container>
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-gray-700"
                onClick={() => setDrawerOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <Link href={userEmail ? "/dashboard" : "/"} className="flex items-center gap-2">
                <div className="relative w-8 h-8 md:w-10 md:h-10">
                   <Image
                    src="/logo.png"
                    alt="isaudi.ai Logo"
                    fill
                    className="object-contain"
                  />
                </div>
                <span className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-isaudi-green-dark to-isaudi-green hidden sm:block">
                  isaudi.ai
                </span>
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-6 mr-8">
                <Link href={userEmail ? "/billing" : "/pricing"} className="text-sm font-medium text-gray-600 hover:text-isaudi-green transition-colors">
                  {t("header.nav.pricing")}
                </Link>
                <Link href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-isaudi-green transition-colors">
                  {t("header.nav.how")}
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
               <Button
                variant="ghost"
                size="sm"
                className="flex gap-2 text-gray-600"
                onClick={toggleLanguage}
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{t("header.lang.toggle")}</span>
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
                    className="text-gray-600 hover:text-red-600 hover:bg-red-50 border-gray-200 hidden sm:flex"
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

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 md:hidden transition-opacity"
          onClick={closeDrawer}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={cn(
          "fixed top-0 bottom-0 z-50 w-64 bg-white shadow-xl transition-transform duration-300 ease-in-out md:hidden flex flex-col",
          lang === "ar" ? "right-0" : "left-0",
          drawerOpen ? "translate-x-0" : lang === "ar" ? "translate-x-full" : "-translate-x-full"
        )}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <Link href={userEmail ? "/dashboard" : "/"} className="flex items-center gap-2" onClick={closeDrawer}>
            <div className="relative w-8 h-8">
               <Image
                src="/logo.png"
                alt="isaudi.ai Logo"
                fill
                className="object-contain"
              />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-isaudi-green-dark to-isaudi-green">
              isaudi.ai
            </span>
          </Link>
          <Button variant="ghost" size="icon" onClick={closeDrawer} className="text-gray-500">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {userEmail ? (
            <>
              <div className="mb-4 px-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                  {t("header.nav.menu") || "Menu"}
                </p>
              </div>
              <Link href="/dashboard" onClick={closeDrawer}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-gray-700">
                  <LayoutDashboard className="w-4 h-4" />
                  {t("dashboard.menu.dashboard")}
                </Button>
              </Link>
              <Link href="/dashboard/reports" onClick={closeDrawer}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-gray-700">
                  <TrendingUp className="w-4 h-4" />
                  {t("dashboard.menu.reports")}
                </Button>
              </Link>
              <Link href="/dashboard/costs" onClick={closeDrawer}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-gray-700">
                  <TrendingUp className="w-4 h-4" />
                  {t("dashboard.menu.costs")}
                </Button>
              </Link>
              <Link href="/connect/salla" onClick={closeDrawer}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-gray-700">
                  <ShoppingBag className="w-4 h-4" />
                  {t("dashboard.menu.connectStore")}
                </Button>
              </Link>
              <Link href="/billing" onClick={closeDrawer}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-gray-700">
                  <CreditCard className="w-4 h-4" />
                  {t("dashboard.menu.billing") || "Billing"}
                </Button>
              </Link>
              <Link href="/settings" onClick={closeDrawer}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-gray-700">
                  <Settings className="w-4 h-4" />
                  {t("dashboard.menu.settings")}
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/pricing" onClick={closeDrawer}>
                <Button variant="ghost" className="w-full justify-start text-gray-700">
                  {t("header.nav.pricing")}
                </Button>
              </Link>
              <Link href="#how-it-works" onClick={closeDrawer}>
                <Button variant="ghost" className="w-full justify-start text-gray-700">
                  {t("header.nav.how")}
                </Button>
              </Link>
            </>
          )}
        </div>

        {userEmail && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col gap-2">
            <span className="text-xs font-medium text-gray-500 truncate px-2 mb-2">
              {userEmail}
            </span>
            <Button
              variant="outline"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => {
                closeDrawer();
                handleLogout();
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t("header.logout")}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
