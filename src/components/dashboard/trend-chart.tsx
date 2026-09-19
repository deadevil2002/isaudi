"use client";

import { useId, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

export interface TrendSnapshot {
  id: string;
  timeRangeStart: string | number;
  timeRangeEnd: string | number;
  grossSales: number;
  totalProfit: number;
  marginPct: number;
  ordersCount: number;
}

interface TrendChartProps {
  data: TrendSnapshot[];
  height?: number;
}

export function TrendChart({ data, height = 240 }: TrendChartProps) {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const isRTL = lang === "ar";
  const reducedMotion = useReducedMotion();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const tooltipId = useId();

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => new Date(a.timeRangeStart).getTime() - new Date(b.timeRangeStart).getTime());
  }, [data]);

  const dimensions = useMemo(() => {
    const width = 800;
    const padding = { top: 18, right: 18, bottom: 30, left: 18 };
    const plotHeight = height - padding.top - padding.bottom;
    const positiveMax = Math.max(1, ...sortedData.flatMap((point) => [point.grossSales, point.totalProfit, 0]));
    const negativeMin = Math.min(0, ...sortedData.map((point) => point.totalProfit));
    const span = positiveMax + Math.abs(negativeMin);
    const zeroY = padding.top + (positiveMax / span) * plotHeight;
    return { width, padding, plotHeight, positiveMax, negativeMin, span, zeroY };
  }, [height, sortedData]);

  const locale = lang === "ar" ? "ar-SA-u-nu-latn" : "en-US";
  const currency = t("common.currency.short");
  const activePoint = selectedIndex === null ? null : sortedData[selectedIndex];
  const groupWidth = (dimensions.width - dimensions.padding.left - dimensions.padding.right) / Math.max(sortedData.length, 1);
  const barWidth = Math.min(26, groupWidth * 0.28);
  const transition = reducedMotion ? { duration: 0 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const };
  const valueY = (value: number) =>
    dimensions.padding.top + ((dimensions.positiveMax - value) / dimensions.span) * dimensions.plotHeight;

  return (
    <div className="relative w-full" style={{ minHeight: height }}>
      <svg
        className="h-auto w-full overflow-visible"
        viewBox={`0 0 ${dimensions.width} ${height}`}
        role="img"
        aria-label={t("dashboard.trend.title")}
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = dimensions.padding.top + dimensions.plotHeight * ratio;
          return (
            <line
              key={ratio}
              x1={0}
              x2={dimensions.width}
              y1={y}
              y2={y}
              stroke="#ffffff1a"
              strokeWidth={1}
              strokeDasharray={ratio === 0 ? "none" : "4 4"}
            />
          );
        })}

        <line
          x1={0}
          x2={dimensions.width}
          y1={dimensions.zeroY}
          y2={dimensions.zeroY}
          stroke="#ffffff33"
          strokeWidth={1}
        />

        {sortedData.map((point, index) => {
          const visualIndex = isRTL ? sortedData.length - 1 - index : index;
          const centerX = dimensions.padding.left + groupWidth * (visualIndex + 0.5);
          const salesY = valueY(point.grossSales);
          const profitY = valueY(point.totalProfit);
          const isSelected = selectedIndex === index;
          const label = `${new Date(point.timeRangeStart).toLocaleDateString(locale)}. ${t("common.sales")} ${point.grossSales.toLocaleString(locale)} ${currency}. ${t("common.profit")} ${point.totalProfit.toLocaleString(locale)} ${currency}.`;

          return (
            <g
              key={point.id}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-describedby={isSelected ? tooltipId : undefined}
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseLeave={() => setSelectedIndex(null)}
              onFocus={() => setSelectedIndex(index)}
              onBlur={() => setSelectedIndex(null)}
              onClick={() => setSelectedIndex((current) => current === index ? null : index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedIndex((current) => current === index ? null : index);
                }
              }}
              className="cursor-pointer outline-none"
            >
              <rect
                x={centerX - groupWidth / 2}
                y={0}
                width={groupWidth}
                height={height}
                fill="transparent"
              />
              <motion.rect
                initial={false}
                animate={{
                  height: Math.abs(dimensions.zeroY - salesY),
                  y: Math.min(salesY, dimensions.zeroY),
                  fill: isSelected ? "#f0f4f8" : "#ffffff4d",
                }}
                transition={transition}
                x={centerX - barWidth - 2}
                width={barWidth}
                rx={barWidth / 3}
              />
              <motion.rect
                initial={false}
                animate={{
                  height: Math.abs(dimensions.zeroY - profitY),
                  y: Math.min(profitY, dimensions.zeroY),
                  fill: point.totalProfit < 0 ? "#ef4444" : isSelected ? "#0fc9a7" : "#0fc9a799",
                }}
                transition={transition}
                x={centerX + 2}
                width={barWidth}
                rx={barWidth / 3}
              />
            </g>
          );
        })}
      </svg>

      <AnimatePresence>
        {activePoint && selectedIndex !== null && (
          <motion.div
            initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: reducedMotion ? 0 : 0.15 }}
            id={tooltipId}
            role="tooltip"
            className="absolute pointer-events-none z-10 top-0 bg-[#161c24] border border-[#ffffff1a] rounded-xl shadow-2xl p-3 text-xs min-w-[170px]"
            style={{
              [isRTL ? "right" : "left"]: `${((selectedIndex + 0.5) / Math.max(sortedData.length, 1)) * 100}%`,
              transform: isRTL ? 'translateX(50%)' : 'translateX(-50%)'
            }}
          >
            <div className="text-[#94a3b8] mb-2 text-center border-b border-[#ffffff1a] pb-2 font-medium">
              {new Date(activePoint.timeRangeStart).toLocaleDateString(locale)} — {new Date(activePoint.timeRangeEnd).toLocaleDateString(locale)}
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-white">{t("common.sales")}</span>
              <span className="font-bold text-white">{activePoint.grossSales.toLocaleString(locale)} {currency}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-[#0fc9a7]">{t("common.profit")}</span>
              <span className="font-bold text-[#0fc9a7]">{activePoint.totalProfit.toLocaleString(locale)} {currency}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}