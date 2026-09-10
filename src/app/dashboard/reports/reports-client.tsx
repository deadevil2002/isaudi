'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";
import { ReportComparisonDetails } from "@/components/dashboard/report-comparison";
import type { ReportComparison } from "@/lib/reports/comparison-format";

type Snap = {
  id: string;
  createdAt: number;
  timeRangeStart: number;
  timeRangeEnd: number;
  grossSales: number;
  totalProfit: number;
  marginPct: number;
  ordersCount: number;
  reportId?: string;
};

export function ReportsClient({ isFree }: { isFree: boolean }) {
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  const [rows, setRows] = useState<Snap[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompareId, setActiveCompareId] = useState<string | null>(null);
  const [compare, setCompare] = useState<ReportComparison | null>(null);
  const [loadingCompareId, setLoadingCompareId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [compareErrorId, setCompareErrorId] = useState<string | null>(null);
  const compareGenerationRef = useRef(0);
  const compareAbortControllerRef = useRef<AbortController | null>(null);
  const locale = lang === "ar" ? "ar-SA-u-nu-latn" : "en-US";
  const currency = t("common.currency.short");

  const loadReports = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch('/api/reports?range=weekly&limit=12', { cache: 'no-store' });
      if (!res.ok) throw new Error("Unable to load reports");
      const data: unknown = await res.json();
      const nestedSnapshots =
        data && typeof data === "object" && "snapshots" in data
          ? (data as { snapshots?: unknown }).snapshots
          : undefined;
      const snapshots = Array.isArray(data)
        ? data
        : Array.isArray(nestedSnapshots)
          ? nestedSnapshots
          : [];
      setRows(snapshots as Snap[]);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReports();
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // Initial request only. Retry calls the same function explicitly.
  }, []);

  useEffect(() => {
    return () => compareAbortControllerRef.current?.abort();
  }, []);

  const handleCompare = async (id: string) => {
    if (loadingCompareId === id) return;
    compareAbortControllerRef.current?.abort();
    const controller = new AbortController();
    compareAbortControllerRef.current = controller;
    const requestGeneration = ++compareGenerationRef.current;
    setLoadingCompareId(id);
    setActiveCompareId(id);
    setCompare(null);
    setCompareErrorId(null);
    try {
      const res = await fetch(
        `/api/reports/compare?current=${encodeURIComponent(id)}&previous=auto`,
        { cache: 'no-store', signal: controller.signal },
      );
      if (!res.ok) throw new Error("Unable to compare reports");
      const data = await res.json();
      if (requestGeneration !== compareGenerationRef.current) return;
      setCompare(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (requestGeneration !== compareGenerationRef.current) return;
      setCompareErrorId(id);
    } finally {
      if (requestGeneration === compareGenerationRef.current) {
        compareAbortControllerRef.current = null;
        setLoadingCompareId(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">{t("reports.title")}</h1>
          <Link href="/dashboard" className="min-h-11 self-start py-3 text-sm font-medium text-isaudi-green">{t("reports.backToDashboard")}</Link>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-base font-semibold">{t("reports.weeklySummaries")}</div>
            {isFree && <Link href="/pricing" className="text-xs text-isaudi-green">{t("reports.upgrade")}</Link>}
          </div>
          {isFree ? (
            <div className="relative">
              <div className="opacity-30 select-none pointer-events-none">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-gray-50">
                      <div className="text-xs text-gray-500">{t("reports.lock.week")}</div>
                      <div className="text-sm font-medium">—</div>
                      <div className="text-xs text-gray-500">{t("reports.lock.metrics")}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-xs bg-white/80 backdrop-blur border rounded-md px-3 py-1">
                  {t("reports.lock.message")}
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-label={t("reports.loading")}>
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-center">
              <p className="text-sm text-red-700">{t("reports.error")}</p>
              <button
                type="button"
                onClick={loadReports}
                className="mt-3 min-h-11 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700"
              >
                {t("reports.retry")}
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-gray-500">{t("reports.empty")}</div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-start text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2">{t("reports.table.week")}</th>
                      <th className="px-3 py-2">{t("reports.table.sales")}</th>
                      <th className="px-3 py-2">{t("reports.table.profit")}</th>
                      <th className="px-3 py-2">{t("reports.table.margin")}</th>
                      <th className="px-3 py-2">{t("reports.table.orders")}</th>
                      <th className="px-3 py-2">{t("reports.table.report")}</th>
                      <th className="px-3 py-2">{t("reports.table.compare")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r) => {
                      const isOpen = activeCompareId === r.id && (compare || compareErrorId === r.id);
                      return (
                        <React.Fragment key={r.id}>
                          <tr>
                            <td className="px-3 py-2 text-xs text-gray-700">
                              {new Date(r.timeRangeStart).toLocaleDateString(locale)} — {new Date(r.timeRangeEnd).toLocaleDateString(locale)}
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-900">
                              {(r.grossSales || 0).toLocaleString(locale)} {currency}
                            </td>
                            <td className="px-3 py-2 text-gray-800">
                              {(r.totalProfit || 0).toLocaleString(locale)} {currency}
                            </td>
                            <td className="px-3 py-2 text-gray-800">
                              {(r.marginPct || 0).toFixed(2)}%
                            </td>
                            <td className="px-3 py-2 text-gray-800">
                              {r.ordersCount || 0}
                            </td>
                            <td className="px-3 py-2">
                              {r.reportId ? (
                                <Link
                                  href={`/dashboard?reportId=${encodeURIComponent(r.reportId)}`}
                                  className="text-xs text-blue-600 border border-blue-200 rounded px-2 py-1"
                                >
                                  {t("reports.openReport")}
                                </Link>
                              ) : (
                                <span className="text-xs text-gray-400">{t("reports.notAvailable")}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                className="min-h-11 rounded border border-isaudi-green/40 px-3 py-2 text-xs text-isaudi-green"
                                onClick={() => handleCompare(r.id)}
                                aria-expanded={Boolean(isOpen)}
                              >
                                {loadingCompareId === r.id
                                  ? t("reports.compare.loading")
                                  : t("reports.compare.button")}
                              </button>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={7} className="px-3 py-2 bg-gray-50 text-xs text-gray-700">
                                {compareErrorId === r.id ? (
                                  <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                                    {t("reports.compare.error")}
                                  </div>
                                ) : compare?.previous ? (
                                  <ReportComparisonDetails comparison={compare} />
                                ) : (
                                  <div>{t("reports.compare.noPrevious")}</div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="flex flex-col gap-4 md:hidden">
                {rows.map((r) => {
                  const isOpen = activeCompareId === r.id && (compare || compareErrorId === r.id);
                  return (
                    <div key={r.id} className="bg-white border rounded-xl p-4 shadow-sm">
                      <div className="text-xs text-gray-500 mb-2">
                        {new Date(r.timeRangeStart).toLocaleDateString(locale)} — {new Date(r.timeRangeEnd).toLocaleDateString(locale)}
                      </div>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm mb-4">
                        <div>
                          <div className="text-gray-500 text-xs">{t("reports.table.sales")}</div>
                          <div className="font-medium">{(r.grossSales || 0).toLocaleString(locale)} {currency}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">{t("reports.table.profit")}</div>
                          <div className="font-medium text-isaudi-green">{(r.totalProfit || 0).toLocaleString(locale)} {currency}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">{t("reports.table.margin")}</div>
                          <div className="font-medium">{(r.marginPct || 0).toFixed(2)}%</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">{t("reports.table.orders")}</div>
                          <div className="font-medium">{r.ordersCount || 0}</div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {r.reportId ? (
                          <Link
                            href={`/dashboard?reportId=${encodeURIComponent(r.reportId)}`}
                            className="flex-1 text-center text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2"
                          >
                            {t("reports.openReport")}
                          </Link>
                        ) : (
                          <div className="flex-1 text-center text-xs text-gray-400 border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
                            {t("reports.notAvailable")}
                          </div>
                        )}
                        <button
                          className="min-h-11 flex-1 rounded-lg border border-isaudi-green/30 bg-isaudi-green/10 px-3 py-2 text-center text-xs font-medium text-isaudi-green"
                          onClick={() => handleCompare(r.id)}
                          aria-expanded={Boolean(isOpen)}
                        >
                          {loadingCompareId === r.id
                            ? t("reports.compare.loading")
                            : t("reports.compare.button")}
                        </button>
                      </div>

                      {isOpen && (
                        <div className="mt-4 pt-4 border-t border-gray-100 bg-gray-50/50 -mx-4 -mb-4 p-4 rounded-b-xl text-xs">
                          {compareErrorId === r.id ? (
                            <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-center text-sm text-red-700">
                              {t("reports.compare.error")}
                            </div>
                          ) : compare?.previous ? (
                            <ReportComparisonDetails comparison={compare} />
                          ) : (
                            <div className="text-center text-gray-500">{t("reports.compare.noPrevious")}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
