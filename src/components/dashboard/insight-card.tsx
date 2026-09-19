"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  expandedContent?: React.ReactNode;
  theme?: "teal" | "gold" | "red" | "default";
}

const themeStyles = {
  teal: "text-[#0fc9a7] bg-[#0fc9a7]/10 border-[#0fc9a7]/30",
  gold: "text-[#e6b95c] bg-[#e6b95c]/10 border-[#e6b95c]/30",
  red: "text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/30",
  default: "text-white bg-[#161c24] border-[#ffffff1a]"
};

const headerStyles = {
  teal: "text-[#0fc9a7]",
  gold: "text-[#e6b95c]",
  red: "text-[#ef4444]",
  default: "text-white"
};

export function InsightCard({ title, icon, content, expandedContent, theme = "default" }: InsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isInteractive = !!expandedContent;
  const reducedMotion = useReducedMotion();

  const heading = (
    <>
      <div className={cn("flex items-center gap-2 text-base font-bold", headerStyles[theme])}>
        {icon}
        {title}
      </div>
      {isInteractive && (
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          className="text-[#94a3b8]"
          aria-hidden="true"
        >
          <ChevronDown className="w-5 h-5" />
        </motion.span>
      )}
    </>
  );

  return (
    <div
      className={cn(
        "rounded-2xl border transition-all duration-300 overflow-hidden",
        theme === "default" ? "bg-[#161c24] border-[#ffffff1a] hover:border-white/10" : themeStyles[theme],
      )}
    >
      <div className="p-5">
        {isInteractive ? (
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-[#0fc9a7]/60"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {heading}
          </button>
        ) : (
          <div className="flex items-center justify-between">{heading}</div>
        )}

        <div className={cn("mt-4", theme === "default" ? "text-[#94a3b8]" : "text-white opacity-90")}>
          {content}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && expandedContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.3, ease: "easeInOut" }}
            className="border-t border-[#ffffff1a]"
          >
            <div className="p-5 bg-black/20">
              {expandedContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}