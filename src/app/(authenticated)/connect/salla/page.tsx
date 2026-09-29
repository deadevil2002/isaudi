"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingBag, AlertCircle, Loader2, Copy, Check, CheckCircle2, ExternalLink } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import { SALLA_INSTALL_URL } from "@/lib/salla/constants";

type ConnectState = "before_install" | "waiting_for_link" | "reconnect_required" | "connected" | "disconnected";

type VerificationOperation = {
  ok: boolean;
  count?: number;
};

type VerificationResponse = {
  connected: boolean;
  products: VerificationOperation;
  orders: VerificationOperation;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readVerificationOperation(value: unknown): VerificationOperation | null {
  if (!isRecord(value) || typeof value.ok !== "boolean") return null;

  const count =
    typeof value.count === "number" &&
    Number.isSafeInteger(value.count) &&
    value.count >= 0
      ? value.count
      : undefined;

  return { ok: value.ok, count };
}

function readVerificationResponse(value: unknown): VerificationResponse | null {
  if (!isRecord(value) || typeof value.connected !== "boolean") return null;

  const products = readVerificationOperation(value.products);
  const orders = readVerificationOperation(value.orders);
  if (!products || !orders) return null;

  return { connected: value.connected, products, orders };
}

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
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResponse | null>(null);
  const [verificationError, setVerificationError] = useState(false);
  const verificationBusyRef = useRef(false);

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

  const verifyConnection = async () => {
    if (verificationBusyRef.current) return;

    verificationBusyRef.current = true;
    setVerificationLoading(true);
    setVerificationResult(null);
    setVerificationError(false);

    try {
      const response = await fetch("/api/connect/salla/verify", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        setVerificationError(true);
        return;
      }

      const body: unknown = await response.json().catch(() => null);
      const result = readVerificationResponse(body);
      if (!result) {
        setVerificationError(true);
        return;
      }

      setVerificationResult(result);
    } catch {
      setVerificationError(true);
    } finally {
      verificationBusyRef.current = false;
      setVerificationLoading(false);
    }
  };

  const renderCodeSection = () => {
    if (!linkCode) return null;

    return (
      <div className="mb-8 space-y-4 rounded-2xl border border-[#e6b95c]/20 bg-[#161c24] p-6 text-center shadow-inner">
        <div className="flex items-center justify-center gap-3">
          <code dir="ltr" className="min-w-0 break-all text-lg font-mono font-bold tracking-wide text-[#004D5A] bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
            {linkCode}
          </code>
          <Button
            variant="outline"
            size="icon"
            onClick={copyToClipboard}
            className="h-12 w-12 shrink-0 text-[#94a3b8] hover:text-[#e6b95c]"
            title={t("connect.salla.code.copy")}
          >
            {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
          </Button>
        </div>

        <div className="h-6 flex items-center justify-center">
          {copied ? (
            <p className="text-sm text-green-600 font-medium">{t("connect.salla.code.copied")}</p>
          ) : !isExpired ? (
            <div className="flex items-center justify-center gap-2 text-sm text-[#94a3b8]">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-isaudi-green opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-isaudi-green"></span>
              </span>
              {t("connect.salla.code.expiresIn")} <span className="font-mono font-medium text-[#e6b95c]">{formatTime(timeLeft)}</span>
            </div>
          ) : (
            <div className="text-sm text-red-500 font-medium">
              {t("connect.salla.code.expired")}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-200">
          <ul className={`space-y-3 text-sm text-[#b7c0cd] ${isRtl ? "text-right" : "text-left"}`}>
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
            className="group w-full rounded-xl bg-[#e6b95c] py-6 text-lg font-bold text-[#06090c] hover:bg-[#f0c96e]"
          >
            {t("connect.salla.button.install")}
            <ExternalLink className={`w-5 h-5 ${isRtl ? "mr-2" : "ml-2"} opacity-70 group-hover:opacity-100 transition-opacity`} />
          </Button>

          {(isExpired || connectState === "waiting_for_link") && (
            <Button
              variant="ghost"
              onClick={generateCode}
              disabled={loading}
              className="text-[#94a3b8] hover:text-white"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("connect.salla.code.regenerate")}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const verificationFailed =
    verificationResult !== null &&
    (!verificationResult.connected ||
      !verificationResult.products.ok ||
      !verificationResult.orders.ok);

  return (
    <div className="mx-auto max-w-2xl" dir={isRtl ? "rtl" : "ltr"}>
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0e1218] p-6 text-center shadow-[0_25px_60px_rgba(0,0,0,.25)] sm:p-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0fc9a7] to-transparent" />
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-[#0fc9a7]/20 bg-[#0fc9a7]/10">
            <ShoppingBag className="h-10 w-10 text-[#0fc9a7]" />
        </div>

        <h1 className="mb-4 text-3xl font-bold text-white">{t("connect.salla.title")}</h1>
        <p className="mb-8 leading-7 text-[#94a3b8]">
          {t("connect.salla.description")}
        </p>

        <div className="mb-6 rounded-xl border border-white/10 bg-[#161c24] p-4 text-sm font-medium text-[#b7c0cd] transition-colors duration-300">
          {connectState === "connected" && t("connect.salla.status.connected")}
          {connectState === "reconnect_required" && t("connect.salla.status.reconnectRequired")}
          {connectState === "disconnected" && t("connect.salla.status.disconnected")}
          {connectState === "waiting_for_link" && t("connect.salla.status.waitingForLink")}
          {connectState === "before_install" && t("connect.salla.status.beforeInstall")}
        </div>

        {(error || codeError) && (
          <div className={`mb-6 flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-300 ${isRtl ? "text-right" : "text-left"}`}>
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
            <>
              <Button
                className="w-full rounded-xl bg-[#0fc9a7] py-6 text-lg font-bold text-[#06251f] hover:bg-[#29ddbc]"
                disabled
              >
                <Check className={`w-5 h-5 ${isRtl ? "ml-2" : "mr-2"}`} />
                {t("connect.salla.button.connected")}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={verifyConnection}
                disabled={verificationLoading}
                aria-busy={verificationLoading}
                data-testid="button-test-salla-connection"
                className="w-full rounded-xl border-[#0fc9a7]/30 bg-[#0fc9a7]/5 py-6 text-lg font-bold text-[#72ead4] hover:bg-[#0fc9a7]/10 hover:text-white"
              >
                {verificationLoading ? (
                  <Loader2 className={`h-5 w-5 animate-spin ${isRtl ? "ml-2" : "mr-2"}`} />
                ) : (
                  <CheckCircle2 className={`h-5 w-5 ${isRtl ? "ml-2" : "mr-2"}`} />
                )}
                {t(verificationLoading ? "connect.salla.button.testing" : "connect.salla.button.test")}
              </Button>
            </>
          ) : connectState === "reconnect_required" || connectState === "disconnected" ? (
            <Button
              onClick={handleInstallClick}
              className="group w-full rounded-xl bg-[#e6b95c] py-6 text-lg font-bold text-[#06090c] hover:bg-[#f0c96e]"
            >
              {connectState === "reconnect_required" ? t("connect.salla.button.reconnect") : t("connect.salla.button.primary")}
              <ExternalLink className={`w-5 h-5 ${isRtl ? "mr-2" : "ml-2"} opacity-70 group-hover:opacity-100 transition-opacity`} />
            </Button>
          ) : !linkCode ? (
            <Button
              onClick={generateCode}
              className="w-full rounded-xl bg-[#e6b95c] py-6 text-lg font-bold text-[#06090c] hover:bg-[#f0c96e]"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" /> : t("connect.salla.code.generate")}
            </Button>
          ) : (
            renderCodeSection()
          )}

          <Link href="/connect/csv" className="block">
            <Button variant="ghost" className="w-full text-[#94a3b8] hover:bg-white/5 hover:text-white">
              {t("connect.salla.button.csv")}
            </Button>
          </Link>
        </div>

        {(verificationLoading || verificationError || verificationResult) && (
          <div
            dir={isRtl ? "rtl" : "ltr"}
            role="status"
            aria-live="polite"
            data-testid="status-salla-verification"
            className={`mt-6 rounded-2xl border p-5 ${
              verificationError || verificationFailed
                ? "border-red-400/20 bg-red-400/10"
                : "border-[#0fc9a7]/20 bg-[#0fc9a7]/5"
            } ${isRtl ? "text-right" : "text-left"}`}
          >
            {verificationLoading ? (
              <div className="flex items-start gap-3 text-[#b7c0cd]">
                <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-isaudi-green" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{t("connect.salla.verification.loading")}</p>
                  <p className="mt-1 text-sm text-[#94a3b8]">{t("connect.salla.verification.loadingDescription")}</p>
                </div>
              </div>
            ) : verificationError ? (
              <div className="flex items-start gap-3 text-red-800">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{t("connect.salla.verification.errorTitle")}</p>
                  <p className="mt-1 text-sm text-red-700">{t("connect.salla.verification.errorDescription")}</p>
                </div>
              </div>
            ) : verificationResult ? (
              <>
                <div className={`flex items-start gap-3 ${verificationFailed ? "text-red-800" : "text-[#004D5A]"}`}>
                  {verificationFailed ? (
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-isaudi-green" aria-hidden="true" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {t(
                        verificationFailed
                          ? "connect.salla.verification.partialTitle"
                          : "connect.salla.verification.successTitle",
                      )}
                    </p>
                    <p className="mt-1 text-sm text-[#94a3b8]">
                      {t(
                        verificationFailed
                          ? "connect.salla.verification.partialDescription"
                          : "connect.salla.verification.successDescription",
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      key: "products" as const,
                      label: t("connect.salla.verification.products"),
                      operation: verificationResult.products,
                    },
                    {
                      key: "orders" as const,
                      label: t("connect.salla.verification.orders"),
                      operation: verificationResult.orders,
                    },
                  ].map(({ key, label, operation }) => (
                    <div
                      key={key}
                      data-testid={`status-salla-verification-${key}`}
                      className={`rounded-xl border bg-[#161c24] p-4 ${
                        operation.ok ? "border-[#0fc9a7]/15" : "border-red-400/20"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {operation.ok ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-isaudi-green" aria-hidden="true" />
                        ) : (
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-white">{label}</p>
                          <p className={`mt-1 text-sm ${operation.ok ? "text-isaudi-green-dark" : "text-red-700"}`}>
                            {t(
                              operation.ok
                                ? "connect.salla.verification.operationSuccess"
                                : "connect.salla.verification.operationFailure",
                            )}
                          </p>
                          {operation.ok && operation.count !== undefined && (
                            <p className="mt-2 text-xs text-[#94a3b8]">
                              {t("connect.salla.verification.firstPageCount")}:{" "}
                              <span className="font-semibold text-white">{operation.count}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-xs leading-5 text-[#64748b]">
                  {t("connect.salla.verification.firstPageNote")}
                </p>
              </>
            ) : null}
          </div>
        )}

        <div className="mt-8 text-xs text-[#64748b]">
          {t("connect.salla.note")}
        </div>
      </div>
    </div>
  );
}

export default function ConnectSallaPage() {
  return (
    <Suspense fallback={<div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0fc9a7]" /></div>}>
      <ConnectSallaContent />
    </Suspense>
  );
}
