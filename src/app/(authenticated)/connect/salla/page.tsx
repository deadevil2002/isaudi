"use client";

import { useEffect, useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingBag, AlertCircle, Loader2, Copy, Check, ExternalLink } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import { SALLA_INSTALL_URL } from "@/lib/salla/constants";

type ConnectState = "before_install" | "waiting_for_link" | "reconnect_required" | "connected" | "disconnected";

function ConnectSallaContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [loading, setLoading] = useState(false);
  const [connectState, setConnectState] = useState<ConnectState>("before_install");

  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [codeError, setCodeError] = useState<"generation_error" | "email_unverified" | null>(null);
  const [copied, setCopied] = useState(false);

  const { lang } = useLanguage();
  const t = createTranslator(lang);

  const isRtl = lang === "ar";

  useEffect(() => {
    let active = true;
    fetch("/api/connect/salla/status", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (active && body?.state && ["before_install", "waiting_for_link", "reconnect_required", "connected", "disconnected"].includes(body.state)) {
          setConnectState(body.state);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (connectState === "waiting_for_link") {
      const id = setInterval(() => {
        fetch("/api/connect/salla/status", { credentials: "same-origin" })
          .then((res) => (res.ok ? res.json() : null))
          .then((body) => {
            if (body?.state && ["before_install", "waiting_for_link", "reconnect_required", "connected", "disconnected"].includes(body.state)) {
              setConnectState(body.state);
            }
          })
          .catch(() => undefined);
      }, 3000);
      return () => clearInterval(id);
    }
  }, [connectState]);

  useEffect(() => {
    if (!expiresAt) return;

    const updateTime = () => {
      setTimeLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    };

    const timeout = setTimeout(updateTime, 0);
    const interval = setInterval(updateTime, 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [expiresAt]);

  const generateCode = async () => {
    setLoading(true);
    setCodeError(null);
    try {
      const res = await fetch("/api/connect/salla/link-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin"
      });
      if (res.status === 403 || res.status === 401) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "email_unverified" || res.status === 403) {
          setCodeError("email_unverified");
        } else {
          setCodeError("generation_error");
        }
      } else if (res.ok) {
        const data = await res.json();
        if (data.code && data.expiresAt) {
          setLinkCode(data.code);
          setExpiresAt(data.expiresAt);
          setConnectState("waiting_for_link");
        } else {
          setCodeError("generation_error");
        }
      } else {
        setCodeError("generation_error");
      }
    } catch {
      setCodeError("generation_error");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (linkCode) {
      try {
        await navigator.clipboard.writeText(linkCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopied(false);
      }
    }
  };

  const isExpired = expiresAt ? timeLeft === 0 : false;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleInstallClick = () => {
    window.location.href = SALLA_INSTALL_URL;
  };

  const renderCodeSection = () => {
    if (!linkCode) return null;

    return (
      <div className="mb-8 p-6 bg-gray-50 border border-gray-100 rounded-xl text-center space-y-4 shadow-inner">
        <div className="flex items-center justify-center gap-3">
          <code dir="ltr" className="min-w-0 break-all text-lg font-mono font-bold tracking-wide text-[#004D5A] bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
            {linkCode}
          </code>
          <Button
            variant="outline"
            size="icon"
            onClick={copyToClipboard}
            className="shrink-0 h-12 w-12 text-gray-500 hover:text-[#004D5A]"
            title={t("connect.salla.code.copy")}
          >
            {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
          </Button>
        </div>

        <div className="h-6 flex items-center justify-center">
          {copied ? (
            <p className="text-sm text-green-600 font-medium">{t("connect.salla.code.copied")}</p>
          ) : !isExpired ? (
            <div className="text-sm text-gray-500 flex items-center justify-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-isaudi-green opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-isaudi-green"></span>
              </span>
              {t("connect.salla.code.expiresIn")} <span className="font-mono font-medium text-gray-700">{formatTime(timeLeft)}</span>
            </div>
          ) : (
            <div className="text-sm text-red-500 font-medium">
              {t("connect.salla.code.expired")}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-200">
          <ul className={`text-sm text-gray-600 space-y-3 ${isRtl ? "text-right" : "text-left"}`}>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#004D5A] shrink-0">1.</span>
              <span>{t("connect.salla.code.instruction1")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#004D5A] shrink-0">2.</span>
              <span>{t("connect.salla.code.instruction2")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#004D5A] shrink-0">3.</span>
              <span>{t("connect.salla.code.instruction3")}</span>
            </li>
          </ul>
        </div>

        <div className="pt-4 flex flex-col gap-3">
          <Button
            onClick={handleInstallClick}
            className="w-full py-6 text-lg font-bold bg-[#B4F3EC] text-[#004D5A] hover:bg-[#A0E0D9] group"
          >
            {t("connect.salla.button.install")}
            <ExternalLink className={`w-5 h-5 ${isRtl ? "mr-2" : "ml-2"} opacity-70 group-hover:opacity-100 transition-opacity`} />
          </Button>

          {(isExpired || connectState === "waiting_for_link") && (
            <Button
              variant="ghost"
              onClick={generateCode}
              disabled={loading}
              className="text-gray-500 hover:text-gray-800"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("connect.salla.code.regenerate")}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-10 h-10 text-isaudi-green" />
        </div>

        <h1 className="text-2xl font-bold mb-4">{t("connect.salla.title")}</h1>
        <p className="text-gray-600 mb-8">
          {t("connect.salla.description")}
        </p>

        <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
          {connectState === "connected" && t("connect.salla.status.connected")}
          {connectState === "reconnect_required" && t("connect.salla.status.reconnectRequired")}
          {connectState === "disconnected" && t("connect.salla.status.disconnected")}
          {connectState === "waiting_for_link" && t("connect.salla.status.waitingForLink")}
          {connectState === "before_install" && t("connect.salla.status.beforeInstall")}
        </div>

        {(error || codeError) && (
          <div className={`mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100 ${isRtl ? "text-right" : "text-left"}`}>
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="text-sm">
              {error === "config_missing" && t("connect.salla.error.config_missing")}
              {error === "no_code" && t("connect.salla.error.no_code")}
              {error === "token_failed" && t("connect.salla.error.token_failed")}
              {error === "server_error" && t("connect.salla.error.server_error")}
              {codeError === "email_unverified" && t("connect.salla.error.email_unverified")}
              {codeError === "generation_error" && t("connect.salla.error.generation")}
              {(!["config_missing", "no_code", "token_failed", "server_error"].includes(error || "") && !codeError && error) &&
                t("connect.salla.error.unknown")}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {connectState === "connected" ? (
            <Button
              className="w-full py-6 text-lg font-bold bg-[#B4F3EC] text-[#004D5A] hover:bg-[#A0E0D9]"
              disabled
            >
              <Check className={`w-5 h-5 ${isRtl ? "ml-2" : "mr-2"}`} />
              {t("connect.salla.button.connected")}
            </Button>
          ) : connectState === "reconnect_required" || connectState === "disconnected" ? (
            <Button
              onClick={handleInstallClick}
              className="w-full py-6 text-lg font-bold bg-[#B4F3EC] text-[#004D5A] hover:bg-[#A0E0D9] group"
            >
              {connectState === "reconnect_required" ? t("connect.salla.button.reconnect") : t("connect.salla.button.primary")}
              <ExternalLink className={`w-5 h-5 ${isRtl ? "mr-2" : "ml-2"} opacity-70 group-hover:opacity-100 transition-opacity`} />
            </Button>
          ) : !linkCode ? (
            <Button
              onClick={generateCode}
              className="w-full py-6 text-lg font-bold bg-[#B4F3EC] text-[#004D5A] hover:bg-[#A0E0D9]"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" /> : t("connect.salla.code.generate")}
            </Button>
          ) : (
            renderCodeSection()
          )}

          <Link href="/connect/csv" className="block">
            <Button variant="ghost" className="w-full text-gray-500">
              {t("connect.salla.button.csv")}
            </Button>
          </Link>
        </div>

        <div className="mt-8 text-xs text-gray-400">
          {t("connect.salla.note")}
        </div>
      </div>
    </div>
  );
}

export default function ConnectSallaPage() {
  return (
    <Suspense fallback={<div className="flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-isaudi-green" /></div>}>
      <ConnectSallaContent />
    </Suspense>
  );
}
