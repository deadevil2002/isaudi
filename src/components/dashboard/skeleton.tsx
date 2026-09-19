"use client";

import { motion, HTMLMotionProps, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type SkeletonProps = HTMLMotionProps<"div">;

export function Skeleton({ className, ...props }: SkeletonProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: reducedMotion ? 1 : 0.5 }}
      animate={{ opacity: 1 }}
      transition={{
        repeat: reducedMotion ? 0 : Infinity,
        repeatType: "reverse",
        duration: 1.5,
        ease: "easeInOut",
      }}
      className={cn("bg-[#ffffff1a] rounded-lg", className)}
      {...props}
    />
  );
}
