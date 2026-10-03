import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useLandingReducedMotion() {
  return useSyncExternalStore(subscribeToReducedMotion, getReducedMotionSnapshot, () => false);
}

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] as const }
  }
};

export const slideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1.0] as const }
  }
};

export const slideInRight = {
  hidden: { opacity: 0, x: 20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1.0] as const }
  }
};

export const slideInLeft = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1.0] as const }
  }
};

export const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    }
  }
};

export const landingReveal = {
  hidden: { opacity: 0, y: 42, scale: 0.97, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.82, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export const landingRevealReduced = {
  hidden: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0 },
  },
};

export const landingStagger = {
  hidden: {},
  visible: {
    transition: { delayChildren: 0.08, staggerChildren: 0.11 },
  },
};

export const landingStaggerReduced = {
  hidden: {},
  visible: {
    transition: { delayChildren: 0, staggerChildren: 0 },
  },
};

export const landingCardStagger = {
  hidden: {},
  visible: {
    transition: { delayChildren: 0.1, staggerChildren: 0.09 },
  },
};

export const landingSectionReveal = {
  hidden: {
    opacity: 0,
    y: 56,
    scale: 0.96,
    rotateX: 3,
    clipPath: "inset(8% 0 12% 0 round 2rem)",
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    clipPath: "inset(0% 0 0% 0 round 2rem)",
    transition: {
      duration: 0.86,
      ease: [0.22, 1, 0.36, 1] as const,
      delayChildren: 0.12,
      staggerChildren: 0.09,
    },
  },
};

export const landingSectionRevealReduced = {
  hidden: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    clipPath: "inset(0% 0 0% 0 round 2rem)",
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    clipPath: "inset(0% 0 0% 0 round 2rem)",
    transition: { duration: 0, delayChildren: 0, staggerChildren: 0 },
  },
};
