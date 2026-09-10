"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";
import {
  Globe,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  TrendingUp,
  ShoppingBag,
  Settings,
  CreditCard,
  PieChart
} from "lucide-react";

interface AuthenticatedShellProps {
  userEmail: string;
  children: React.ReactNode;
}

export function AuthenticatedShell({ userEmail, children }: AuthenticatedShellProps) {
  const { toggleLanguage, lang } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
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

  // Derive active states
  const isDashboard = pathname === "/dashboard";
  const isReports = pathname === "/dashboard/reports";
  const isCosts = pathname === "/dashboard/costs";
  const isConnectStore = pathname.startsWith("/connect");
  const isBilling = pathname === "/billing";
  const isSettings = pathname === "/settings";

  const navigationItems = [
    { href: "/dashboard", label: t("dashboard.menu.dashboard"), icon: LayoutDashboard, active: isDashboard },
    { href: "/dashboard/reports", label: t("dashboard.menu.reports"), icon: PieChart, active: isReports },
    { href: "/dashboard/costs", label: t("dashboard.menu.costs"), icon: TrendingUp, active: isCosts },
    { href: "/connect/salla", label: t("dashboard.menu.connectStore"), icon: ShoppingBag, active: isConnectStore },
    { href: "/billing", label: t("dashboard.menu.billing"), icon: CreditCard, active: isBilling },
    { href: "/settings", label: t("dashboard.menu.settings"), icon: Settings, active: isSettings },
  ];

  const renderNavigation = (mobile = false) =>
    navigationItems.map(({ href, label, icon: Icon, active }) => (
      <Link
        key={href}
        href={href}
        onClick={mobile ? closeDrawer : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 w-full items-center rounded-md font-semibold transition-colors",
          mobile ? "gap-3 px-3 py-2" : "gap-2 px-3 py-2",
          active
            ? mobile
              ? "bg-isaudi-green/10 text-isaudi-green"
              : "border border-gray-100/50 bg-white text-isaudi-green shadow-sm"
            : mobile
              ? "text-gray-700 hover:bg-gray-50"
              : "border border-transparent text-gray-600 hover:bg-white hover:text-gray-900",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </Link>
    ));

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <Container>
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                ref={menuButtonRef}
                className="text-gray-700"
                onClick={() => setDrawerOpen(true)}
                aria-label={t("header.nav.openMenu")}
                aria-controls="authenticated-mobile-navigation"
                aria-expanded={drawerOpen}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="relative w-8 h-8">
                   <Image
                    src="/brand/isaudi-mark-v4"
                    alt="isaudi.ai Logo"
                    fill
                    className="object-contain"
                  />
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-isaudi-green-dark to-isaudi-green">
                  isaudi.ai
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-2">
               <Button
                variant="ghost"
                size="sm"
                className="text-gray-600"
                onClick={toggleLanguage}
                aria-label={t("header.lang.aria")}
              >
                <Globe className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Container>
      </header>

      {/* Mobile Drawer */}
      <dialog
        ref={drawerRef}
        id="authenticated-mobile-navigation"
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
            <Link href="/dashboard" className="flex items-center gap-2" onClick={closeDrawer}>
              <div className="relative w-8 h-8">
                 <Image
                   src="/brand/isaudi-mark-v4"
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
              data-drawer-close
              aria-label={t("header.nav.closeMenu")}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            <div className="mb-4 px-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                {t("header.nav.menu")}
              </p>
            </div>

            <nav aria-label={t("header.nav.menu")} className="space-y-1">
              {renderNavigation(true)}
            </nav>
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col gap-2">
            <span className="text-xs font-medium text-gray-500 truncate px-2 mb-2">
              {userEmail}
            </span>
            <Button
              variant="outline"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 bg-white"
              onClick={() => {
                closeDrawer();
                handleLogout();
              }}
            >
               <LogOut className="me-2 w-4 h-4" />
              {t("header.logout")}
            </Button>
          </div>
        </div>
      </dialog>

      {/* Main Layout */}
      <div className="min-h-[100dvh] bg-gray-50 pt-16 md:pt-24 pb-12 flex flex-col">
        <Container className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 flex-1 min-h-0">

            {/* Desktop Sidebar */}
            <aside className="hidden w-64 shrink-0 flex-col gap-6 self-start md:sticky md:top-6 md:flex">
              <Link href="/dashboard" className="flex items-center gap-3 px-2">
                <div className="relative w-10 h-10">
                   <Image
                    src="/brand/isaudi-mark-v4"
                    alt="isaudi.ai Logo"
                    fill
                    className="object-contain"
                  />
                </div>
                <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-isaudi-green-dark to-isaudi-green">
                  isaudi.ai
                </span>
              </Link>

              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-isaudi-green/10 flex items-center justify-center text-isaudi-green font-bold text-lg shrink-0">
                    {userEmail.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-sm font-bold truncate text-gray-900">{userEmail}</div>
                  </div>
                </div>

                <div className="h-px w-full bg-gray-100" />

                <nav aria-label={t("header.nav.menu")} className="-mx-2 space-y-1 px-2">
                  {renderNavigation()}
                </nav>

                <div className="h-px w-full bg-gray-100" />

                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-gray-600 hover:bg-gray-50"
                    onClick={toggleLanguage}
                    aria-label={t("header.lang.aria")}
                  >
                    <Globe className="w-4 h-4" />
                    <span>{t("header.lang.toggle")}</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t("header.logout")}</span>
                  </Button>
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0">
              {children}
            </main>
          </div>
        </Container>
      </div>
    </>
  );
}
