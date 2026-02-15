'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

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

type CompareResult = {
  current: {
    id: string;
    timeRangeStart: number;
    timeRangeEnd: number;
    sales: number;
    profit: number;
    marginPct: number;
    orders: number;
  };
  previous: {
    id: string;
    timeRangeStart: number;
    timeRangeEnd: number;
    sales: number;
    profit: number;
    marginPct: number;
    orders: number;
  } | null;
  deltas: {
    salesDeltaPct: number | null;
    profitDeltaPct: number | null;
    marginDeltaPct: number | null;
    ordersDelta: number | null;
  };
  status: 'improved' | 'declined' | 'no_change';
};

export function ReportsClient({ isFree }: { isFree: boolean }) {
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  const [rows, setRows] = useState<Snap[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompareId, setActiveCompareId] = useState<string | null>(null);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [loadingCompareId, setLoadingCompareId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/reports?range=weekly&limit=12', { cache: 'no-store' });
      if (res.status === 401) { setLoading(false); return; }
      const data = await res.json();
      setRows(data.snapshots || []);
      setLoading(false);
    })();
  }, []);

  const handleCompare = async (id: string) => {
    if (loadingCompareId === id) return;
    setLoadingCompareId(id);
    setActiveCompareId(id);
    try {
      const res = await fetch(`/api/reports/compare?current=${encodeURIComponent(id)}&previous=auto`, { cache: 'no-store' });
      const data = await res.json();
      setCompare(data);
    } finally {
      setLoadingCompareId(null);
    }
  };

  const renderStatusLabel = (status: CompareResult['status']) => {
    if (status === 'improved') return { text: t("common.status.improved"), className: 'text-green-600' };
    if (status === 'declined') return { text: t("common.status.declined"), className: 'text-red-600' };
    return { text: t("common.status.noChange"), className: 'text-gray-600' };
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{t("reports.title")}</h1>
          <Link href="/dashboard" className="text-sm text-isaudi-green">{t("reports.backToDashboard")}</Link>
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
            <div className="text-sm text-gray-500">{t("reports.loading")}</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-gray-500">{t("reports.empty")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-right">
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
                    const isOpen = activeCompareId === r.id && compare;
                    const statusInfo = compare ? renderStatusLabel(compare.status) : null;
                    return (
                      <React.Fragment key={r.id}>
                        <tr>
                          <td className="px-3 py-2 text-xs text-gray-700">
                            {new Date(r.timeRangeStart).toLocaleDateString()} — {new Date(r.timeRangeEnd).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900">
                            {(r.grossSales || 0).toLocaleString()} SAR
                          </td>
                          <td className="px-3 py-2 text-gray-800">
                            {(r.totalProfit || 0).toLocaleString()} SAR
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
                              className="text-xs text-isaudi-green border border-isaudi-green/40 rounded px-2 py-1"
                              onClick={() => handleCompare(r.id)}
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
                              {compare?.previous ? (
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    <span>{t("reports.compare.result")}</span>
                                    {statusInfo && (
                                      <span className={statusInfo.className}>{statusInfo.text}</span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                                    <div>
                                      <div className="font-semibold">{t("reports.compare.sales")}</div>
                                      <div>
                                        {compare.previous.sales.toLocaleString()} SAR → {compare.current.sales.toLocaleString()} SAR
                                        {" "}
                                        ({(compare.current.sales - compare.previous.sales).toLocaleString()} SAR,
                                        {" "}
                                        {compare.deltas.salesDeltaPct == null ? '—' : `${compare.deltas.salesDeltaPct.toFixed(2)}%`})
                                      </div>
                                    </div>
                                    <div>
                                      <div className="font-semibold">{t("reports.compare.profit")}</div>
                                      <div>
                                        {compare.previous.profit.toLocaleString()} SAR → {compare.current.profit.toLocaleString()} SAR
                                        {" "}
                                        ({(compare.current.profit - compare.previous.profit).toLocaleString()} SAR,
                                        {" "}
                                        {compare.deltas.profitDeltaPct == null ? '—' : `${compare.deltas.profitDeltaPct.toFixed(2)}%`})
                                      </div>
                                    </div>
                                    <div>
                                      <div className="font-semibold">{t("reports.compare.margin")}</div>
                                      <div>
                                        {compare.previous.marginPct.toFixed(2)}% → {compare.current.marginPct.toFixed(2)}%
                                        {" "}
                                        ({compare.deltas.marginDeltaPct == null
                                          ? '—'
                                          : `${compare.deltas.marginDeltaPct.toFixed(2)}${t("dashboard.compare.delta.marginPts")}`})
                                      </div>
                                    </div>
                                    <div>
                                      <div className="font-semibold">{t("reports.compare.orders")}</div>
                                      <div>
                                        {compare.previous.orders} → {compare.current.orders}
                                        {" "}
                                        ({compare.deltas.ordersDelta == null ? '—' : `${compare.deltas.ordersDelta > 0 ? '+' : ''}${compare.deltas.ordersDelta}`})
                                      </div>
                                    </div>
                                  </div>
                                </div>
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
          )}
        </div>
      </div>
    </div>
  );
}
