"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Globe, LogOut, Menu, X, LayoutDashboard, TrendingUp, ShoppingBag, Settings, CreditCard } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { useRouter } from "next/navigation";
import { createTranslator } from "@/lib/i18n/translations";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  userEmail?: string;
}

export function Header({ userEmail }: HeaderProps) {
  const { toggleLanguage, lang } = useLanguage();
  const router = useRouter();
  const t = createTranslator(lang);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;

    if (!drawerOpen) {
      if (drawer.open) drawer.close();
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!drawer.open) drawer.showModal();
    const frameId = window.requestAnimationFrame(() => {
      drawer.querySelector<HTMLElement>("[data-drawer-close]")?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frameId);
    };
  }, [drawerOpen]);

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
                ref={menuButtonRef}
                className="md:hidden text-gray-700"
                onClick={() => setDrawerOpen(true)}
                aria-label={t("header.nav.openMenu")}
                aria-controls="mobile-navigation"
                aria-expanded={drawerOpen}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <Link href={userEmail ? "/dashboard" : "/"} className="flex items-center gap-2">
                <div className="relative w-8 h-8 md:w-10 md:h-10">
                   <Image
                    src="/brand/isaudi-mark-v1.png"
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
              <nav className="ms-8 hidden items-center gap-6 md:flex">
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
                aria-label={t("header.lang.aria")}
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
                    <LogOut className="w-4 h-4 md:ms-2" />
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

      {/* Mobile Drawer */}
      <dialog
        ref={drawerRef}
        id="mobile-navigation"
        aria-label={t("header.nav.menu")}
        onCancel={(event) => {
          event.preventDefault();
          closeDrawer();
        }}
        onClose={() => {
          setDrawerOpen(false);
          menuButtonRef.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
        className={cn(
          "fixed bottom-0 top-0 z-50 m-0 h-dvh w-[min(18rem,calc(100vw-1.5rem))] max-h-none max-w-full border-0 bg-white p-0 shadow-xl md:hidden [&::backdrop]:bg-black/40",
          lang === "ar" ? "left-auto right-0" : "left-0 right-auto",
        )}
      >
        <div className="flex h-full flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <Link href={userEmail ? "/dashboard" : "/"} className="flex items-center gap-2" onClick={closeDrawer}>
            <div className="relative w-8 h-8">
               <Image
                 src="/brand/isaudi-mark-v1.png"
                alt="isaudi.ai Logo"
                fill
                className="object-contain"
              />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-isaudi-green-dark to-isaudi-green">
              isaudi.ai
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeDrawer}
            className="text-gray-500"
            aria-label={t("header.nav.closeMenu")}
            data-drawer-close
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {userEmail ? (
            <>
              <div className="mb-4 px-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                  {t("header.nav.menu")}
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
                  {t("dashboard.menu.billing")}
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
               <LogOut className="me-2 w-4 h-4" />
              {t("header.logout")}
            </Button>
          </div>
        )}
        </div>
      </dialog>
    </>
  );
}
