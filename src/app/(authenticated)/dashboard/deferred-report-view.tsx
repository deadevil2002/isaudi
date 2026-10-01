"use client";

import { motion, useReducedMotion } from 'framer-motion';
import { ReportView } from '@/components/dashboard/report-view';
import type { ReportViewData } from '@/lib/dashboard/report-view-data';

export function DeferredReportView({ data }: { data: ReportViewData }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.28, ease: 'easeOut' }}
    >
      <ReportView data={data} />
    </motion.div>
  );
}
