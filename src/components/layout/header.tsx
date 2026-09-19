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
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#06090c]/80 backdrop-blur-md border-b border-white/10">
        <Container>
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                ref={menuButtonRef}
                className="md:hidden text-white hover:bg-white/10"
                onClick={() => setDrawerOpen(true)}
                aria-label={t("header.nav.openMenu")}
                aria-controls="mobile-navigation"
                aria-expanded={drawerOpen}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <Link href={userEmail ? "/dashboard" : "/"} className="flex items-center">
                <div className="relative w-[5.35rem] h-10">
                   <Image
                    src="/brand/design-preview-logo.png"
                    alt="iSaudi.ai Logo"
                    fill
                    className="object-contain"
                  />
                </div>
              </Link>

              {/* Desktop Navigation */}
              <nav className="ms-8 hidden items-center gap-6 md:flex">
                <Link href={userEmail ? "/billing" : "/pricing"} className="text-sm font-medium text-[#94a3b8] hover:text-white transition-colors">
                  {t("header.nav.pricing")}
                </Link>
                <Link href="/how-it-works" className="text-sm font-medium text-[#94a3b8] hover:text-white transition-colors">
                  {t("header.nav.how")}
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
               <Button
                variant="ghost"
                size="sm"
                className="flex gap-2 text-[#94a3b8] hover:text-white hover:bg-white/10"
                onClick={toggleLanguage}
                aria-label={t("header.lang.aria")}
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{t("header.lang.toggle")}</span>
              </Button>

              {userEmail ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[#94a3b8] hidden md:inline-block">
                    {userEmail}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleLogout}
                    className="text-[#94a3b8] hover:text-red-400 hover:bg-white/10 border-white/10 bg-transparent hidden sm:flex"
                  >
                    <LogOut className="w-4 h-4 md:ms-2" />
                    <span className="hidden md:inline">
                      {t("header.logout")}
                    </span>
                  </Button>
                </div>
              ) : (
                <Link href="/login">
                  <Button size="sm" className="bg-gradient-to-r from-[#c5993c] to-[#e6b95c] hover:opacity-90 text-black shadow-sm transition-all border-none font-semibold rounded-full px-6">
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
          "fixed bottom-0 top-0 z-50 m-0 h-dvh w-[min(18rem,calc(100vw-1.5rem))] max-h-none max-w-full border-0 bg-[#06090c] text-[#f0f4f8] p-0 shadow-xl md:hidden [&::backdrop]:bg-black/80",
          lang === "ar" ? "left-auto right-0" : "left-0 right-auto",
        )}
      >
        <div className="flex h-full flex-col">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <Link href={userEmail ? "/dashboard" : "/"} className="flex items-center" onClick={closeDrawer}>
            <div className="relative w-[5.35rem] h-8">
               <Image
                 src="/brand/design-preview-logo.png"
                alt="iSaudi.ai Logo"
                fill
                className="object-contain"
              />
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeDrawer}
            className="text-[#94a3b8] hover:text-white hover:bg-white/10 rounded-full"
            aria-label={t("header.nav.closeMenu")}
            data-drawer-close
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 mt-4">
          {userEmail ? (
            <>
              <div className="mb-2 px-2">
                <p className="text-xs text-[#64748b] uppercase tracking-wider font-semibold">
                  {t("header.nav.menu")}
                </p>
              </div>
              <Link href="/dashboard" onClick={closeDrawer}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-[#94a3b8] hover:text-white hover:bg-white/5 rounded-xl">
                  <LayoutDashboard className="w-4 h-4" />
                  {t("dashboard.menu.dashboard")}
                </Button>
              </Link>
              <Link href="/dashboard/reports" onClick={closeDrawer}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-[#94a3b8] hover:text-white hover:bg-white/5 rounded-xl">
                  <TrendingUp className="w-4 h-4" />
                  {t("dashboard.menu.reports")}
                </Button>
              </Link>
              <Link href="/dashboard/costs" onClick={closeDrawer}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-[#94a3b8] hover:text-white hover:bg-white/5 rounded-xl">
                  <TrendingUp className="w-4 h-4" />
                  {t("dashboard.menu.costs")}
                </Button>
              </Link>
              <Link href="/connect/salla" onClick={closeDrawer}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-[#94a3b8] hover:text-white hover:bg-white/5 rounded-xl">
                  <ShoppingBag className="w-4 h-4" />
                  {t("dashboard.menu.connectStore")}
                </Button>
              </Link>
              <Link href="/billing" onClick={closeDrawer}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-[#94a3b8] hover:text-white hover:bg-white/5 rounded-xl">
                  <CreditCard className="w-4 h-4" />
                  {t("dashboard.menu.billing")}
                </Button>
              </Link>
              <Link href="/settings" onClick={closeDrawer}>
                <Button variant="ghost" className="w-full justify-start gap-3 text-[#94a3b8] hover:text-white hover:bg-white/5 rounded-xl">
                  <Settings className="w-4 h-4" />
                  {t("dashboard.menu.settings")}
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/pricing" onClick={closeDrawer} className="block">
                <span className="block px-4 py-2 text-lg text-[#94a3b8] hover:text-white transition-colors">{t("header.nav.pricing")}</span>
              </Link>
              <Link href="/how-it-works" onClick={closeDrawer} className="block">
                <span className="block px-4 py-2 text-lg text-[#94a3b8] hover:text-white transition-colors">{t("header.nav.how")}</span>
              </Link>
            </>
          )}
        </div>

        <div className="mt-auto p-4 flex flex-col gap-4 pb-8">
          {userEmail ? (
            <>
              <span className="text-xs font-medium text-[#64748b] truncate px-2 mb-2 block">
                {userEmail}
              </span>
              <Button
                variant="outline"
                className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 border-white/10 rounded-full"
                onClick={() => {
                  closeDrawer();
                  handleLogout();
                }}
              >
                 <LogOut className="me-2 w-4 h-4" />
                {t("header.logout")}
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="w-full block">
                <Button className="w-full bg-[#1d252f] hover:bg-[#161c24] text-white border border-white/10 rounded-full py-6 text-lg font-medium">
                  {t("header.login")}
                </Button>
              </Link>
              <Link href="/pricing" className="w-full block">
                <Button className="w-full bg-gradient-to-r from-[#c5993c] to-[#e6b95c] hover:opacity-90 text-black border-none rounded-full py-6 text-lg font-bold">
                  {t("header.viewPlans")}
                </Button>
              </Link>
            </>
          )}
        </div>
        </div>
      </dialog>
    </>
  );
}
