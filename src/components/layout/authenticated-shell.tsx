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

export interface AuthenticatedShellProps {
  userEmail: string;
  children: React.ReactNode;

  // Preview mode props
  isPreview?: boolean;
  previewNavItems?: Array<{
    href: string;
    label: string;
    icon: React.ElementType;
    active: boolean;
  }>;
  onPreviewNavClick?: (href: string) => void;
  onPreviewLogout?: () => void;
  onPreviewLangToggle?: () => void;
  previewTopOffsetClass?: string;
  previewHomeHref?: string;
  previewLanguageHref?: string;
}

export function AuthenticatedShell({
  userEmail,
  children,
  isPreview,
  previewNavItems,
  onPreviewNavClick,
  onPreviewLogout,
  onPreviewLangToggle,
  previewTopOffsetClass,
  previewHomeHref,
  previewLanguageHref,
}: AuthenticatedShellProps) {
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
        if (drawerRef.current?.open) drawerRef.current.close();
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
  }, [drawerOpen, isPreview]);

  const handleLogout = async () => {
    if (isPreview) {
      onPreviewLogout?.();
      return;
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const closeDrawer = () => {
    if (drawerRef.current?.open) drawerRef.current.close();
    setDrawerOpen(false);
  };
  const homeHref = isPreview && previewHomeHref ? previewHomeHref : "/dashboard";

  const handleLangToggle = () => {
    if (isPreview && onPreviewLangToggle) {
      onPreviewLangToggle();
    } else {
      toggleLanguage();
    }
  };

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isPreview && onPreviewNavClick) {
      e.preventDefault();
      onPreviewNavClick("/dashboard");
    }
  };

  // Derive active states
  const isDashboard = pathname === "/dashboard";
  const isReports = pathname === "/dashboard/reports";
  const isCosts = pathname === "/dashboard/costs";
  const isConnectStore = pathname.startsWith("/connect");
  const isBilling = pathname === "/billing";
  const isSettings = pathname === "/settings";

  const defaultNavItems = [
    { href: "/dashboard", label: t("dashboard.menu.dashboard"), icon: LayoutDashboard, active: isDashboard },
    { href: "/dashboard/reports", label: t("dashboard.menu.reports"), icon: PieChart, active: isReports },
    { href: "/dashboard/costs", label: t("dashboard.menu.costs"), icon: TrendingUp, active: isCosts },
    { href: "/connect/salla", label: t("dashboard.menu.connectStore"), icon: ShoppingBag, active: isConnectStore },
    { href: "/billing", label: t("dashboard.menu.billing"), icon: CreditCard, active: isBilling },
    { href: "/settings", label: t("dashboard.menu.settings"), icon: Settings, active: isSettings },
  ];

  const currentNavItems = isPreview && previewNavItems ? previewNavItems : defaultNavItems;
  const previewOpenCommand: Record<string, string> = {
    commandfor: "authenticated-mobile-navigation",
    command: "show-modal",
  };
  const previewCloseCommand: Record<string, string> = {
    commandfor: "authenticated-mobile-navigation",
    command: "close",
  };

  const renderNavigation = (mobile = false) =>
    currentNavItems.map(({ href, label, icon: Icon, active }) => (
      <Link
        key={href}
        href={href}
        onClick={(e) => {
          if (mobile) closeDrawer();
          if (isPreview && onPreviewNavClick) {
            e.preventDefault();
            onPreviewNavClick(href);
          }
        }}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 w-full items-center rounded-xl font-medium transition-colors",
          mobile ? "gap-3 px-4 py-2.5" : "gap-3 px-3 py-2.5",
          active
            ? "bg-[#0fc9a7]/10 text-[#0fc9a7]"
            : "text-[#94a3b8] hover:bg-[#1d252f] hover:text-[#f0f4f8]",
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span>{label}</span>
      </Link>
    ));

  return (
    <>
      {/* Mobile Header */}
      <header className={cn("md:hidden fixed top-0 left-0 right-0 z-40 bg-[#06090c]/80 backdrop-blur-md border-b border-[#ffffff1a]", previewTopOffsetClass)}>
        <Container>
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {isPreview ? (
                <button
                  type="button"
                  {...previewOpenCommand}
                  data-preview-drawer-open
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#94a3b8] hover:bg-[#1d252f] hover:text-[#f0f4f8]"
                  aria-label={t("header.nav.openMenu")}
                  aria-controls="authenticated-mobile-navigation"
                  aria-haspopup="dialog"
                >
                  <Menu className="h-5 w-5" />
                </button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  ref={menuButtonRef}
                  className="text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#1d252f] rounded-full"
                  onClick={() => setDrawerOpen(true)}
                  aria-label={t("header.nav.openMenu")}
                  aria-controls="authenticated-mobile-navigation"
                  aria-expanded={drawerOpen}
                >
                  <Menu className="w-5 h-5" />
                </Button>
              )}
              <Link href={homeHref} className="flex items-center" onClick={handleLogoClick}>
                 <Image
                  src="/brand/design-preview-logo.png"
                  alt="iSaudi.ai Logo"
                  width={85}
                  height={64}
                  className="w-[85px] h-auto object-contain"
                  priority
                />
              </Link>
            </div>

            <div className="flex items-center gap-2">
              {isPreview && previewLanguageHref ? (
                <Link
                  href={previewLanguageHref}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#94a3b8] hover:bg-[#1d252f] hover:text-[#f0f4f8]"
                  aria-label={t("header.lang.aria")}
                >
                  <Globe className="h-5 w-5" />
                </Link>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#1d252f] rounded-full"
                  onClick={handleLangToggle}
                  aria-label={t("header.lang.aria")}
                >
                  <Globe className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </Container>
      </header>

      {/* Mobile Drawer */}
      <dialog
        ref={drawerRef}
        id="authenticated-mobile-navigation"
        aria-label={t("header.nav.menu")}
        aria-modal={isPreview ? "true" : undefined}
        onCancel={(event) => {
          event.preventDefault();
          event.currentTarget.close();
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
          "fixed bottom-0 top-0 z-50 m-0 h-dvh w-[min(18rem,calc(100vw-1.5rem))] max-h-none max-w-full border-0 bg-[#0e1218] p-0 shadow-2xl md:hidden [&::backdrop]:bg-black/60",
          previewTopOffsetClass,
          lang === "ar" ? "left-auto right-0 border-l border-[#ffffff1a]" : "left-0 right-auto border-r border-[#ffffff1a]",
        )}
      >
        <div className="flex h-full flex-col text-[#f0f4f8] bg-[#0e1218]">
          <div className="p-4 border-b border-[#ffffff1a] flex items-center justify-between">
            <Link href={homeHref} className="flex items-center" onClick={(e) => { handleLogoClick(e); closeDrawer(); }}>
              <Image
                src="/brand/design-preview-logo.png"
                alt="iSaudi.ai Logo"
                width={85}
                height={64}
                className="w-[85px] h-auto object-contain"
              />
            </Link>
            {isPreview ? (
              <button
                type="button"
                {...previewCloseCommand}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#94a3b8] hover:bg-[#1d252f] hover:text-[#f0f4f8]"
                data-drawer-close
                aria-label={t("header.nav.closeMenu")}
              >
                <X className="h-5 w-5" />
              </button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={closeDrawer}
                className="text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#1d252f] rounded-full"
                data-drawer-close
                aria-label={t("header.nav.closeMenu")}
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            <nav aria-label={t("header.nav.menu")} className="space-y-1">
              {renderNavigation(true)}
            </nav>
          </div>

          <div className="p-4 border-t border-[#ffffff1a] bg-[#161c24] flex flex-col gap-2">
            <div className="flex items-center gap-3 mb-2 px-2">
              <div className="w-9 h-9 rounded-full bg-[#e6b95c]/10 flex items-center justify-center text-[#e6b95c] font-bold text-sm shrink-0">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-[#f0f4f8] truncate">
                {userEmail}
              </span>
            </div>

            {isPreview && previewLanguageHref ? (
              <Link
                href={previewLanguageHref}
                className="flex min-h-10 w-full items-center justify-start gap-3 rounded-xl px-4 font-medium text-[#94a3b8] hover:bg-[#1d252f] hover:text-[#f0f4f8]"
                onClick={closeDrawer}
              >
                <Globe className="h-5 w-5" />
                {t("header.lang.toggle")}
              </Link>
            ) : (
              <Button
                variant="ghost"
                className="w-full justify-start text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#1d252f] rounded-xl gap-3 font-medium px-4"
                onClick={() => {
                  closeDrawer();
                  handleLangToggle();
                }}
              >
                <Globe className="w-5 h-5" />
                {t("header.lang.toggle")}
              </Button>
            )}

            {!isPreview && (
              <Button
                variant="ghost"
                className="w-full justify-start text-[#ef4444] hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded-xl gap-3 font-medium px-4"
                onClick={() => {
                  closeDrawer();
                  handleLogout();
                }}
              >
                 <LogOut className="w-5 h-5" />
                {t("header.logout")}
              </Button>
            )}
          </div>
        </div>
      </dialog>

      {/* Main Layout */}
      <div id="qa-shell-content" className="min-h-[100dvh] bg-[#06090c] text-[#f0f4f8] pt-16 md:pt-24 pb-12 flex flex-col font-sans relative">
        {/* Ambient Background */}
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            background: 'radial-gradient(circle at 50% 0%, rgba(15, 201, 167, 0.08) 0%, transparent 50%), radial-gradient(circle at 100% 50%, rgba(230, 185, 92, 0.08) 0%, transparent 40%)'
          }}
        />

        <Container className="flex-1 flex flex-col min-h-0 relative z-10">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 flex-1 min-h-0">

            {/* Desktop Sidebar */}
            <aside className={cn("hidden w-64 shrink-0 self-start md:sticky md:flex", previewTopOffsetClass ? "md:top-[calc(1.5rem+3rem)]" : "md:top-6")}>
              <div className="w-full bg-[#0e1218] p-4 rounded-2xl border border-[#ffffff1a] shadow-lg flex flex-col gap-2 relative overflow-hidden">
                {/* Subtle top edge highlight */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#ffffff1a] to-transparent" />

                <div className="pb-6 pt-2 mb-2 border-b border-[#ffffff1a] flex justify-center">
                  <Link href={homeHref} className="flex items-center" onClick={handleLogoClick}>
                    <Image
                      src="/brand/design-preview-logo.png"
                      alt="iSaudi.ai Logo"
                      width={120}
                      height={90}
                      className="w-[120px] h-auto object-contain"
                      priority
                    />
                  </Link>
                </div>

                <div className="flex items-center gap-3 px-3 mb-4 mt-2">
                  <div className="w-10 h-10 rounded-full bg-[#e6b95c]/10 flex items-center justify-center text-[#e6b95c] font-bold text-sm shrink-0 border border-[#e6b95c]/20">
                    {userEmail.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 overflow-hidden">
                    <div className="text-sm font-bold truncate text-[#f0f4f8]">{userEmail}</div>
                  </div>
                </div>

                <nav aria-label={t("header.nav.menu")} className="space-y-1">
                  {renderNavigation()}
                </nav>

                <div className="mt-4 pt-4 border-t border-[#ffffff1a] flex flex-col gap-1">
                  {isPreview && previewLanguageHref ? (
                    <Link
                      href={previewLanguageHref}
                      className="flex min-h-11 w-full items-center justify-start gap-3 rounded-xl px-3 py-2.5 font-medium text-[#94a3b8] hover:bg-[#1d252f] hover:text-[#f0f4f8]"
                      aria-label={t("header.lang.aria")}
                    >
                      <Globe className="h-5 w-5" />
                      <span>{t("header.lang.toggle")}</span>
                    </Link>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-3 text-[#94a3b8] hover:bg-[#1d252f] hover:text-[#f0f4f8] rounded-xl font-medium px-3 py-2.5 min-h-11"
                      onClick={handleLangToggle}
                      aria-label={t("header.lang.aria")}
                    >
                      <Globe className="w-5 h-5" />
                      <span>{t("header.lang.toggle")}</span>
                    </Button>
                  )}

                  {!isPreview && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-3 text-[#94a3b8] hover:bg-[#ef4444]/10 hover:text-[#ef4444] rounded-xl font-medium px-3 py-2.5 min-h-11"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-5 h-5" />
                      <span>{t("header.logout")}</span>
                    </Button>
                  )}
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
