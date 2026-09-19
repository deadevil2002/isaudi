import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

export function AnimatedNumber({
  value,
  duration = 0.8,
  formatter = (v) => Math.round(v).toString(),
  className
}: {
  value: number;
  duration?: number;
  formatter?: (val: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "0px" });
  const reducedMotion = useReducedMotion();
  const prevValue = useRef(0);

  useEffect(() => {
    if (!ref.current) return;
    if (reducedMotion) {
      ref.current.textContent = formatter(value);
      prevValue.current = value;
      return;
    }
    if (isInView) {
      const controls = animate(prevValue.current, value, {
        duration,
        ease: "easeOut",
        onUpdate: (v) => {
          if (ref.current) ref.current.textContent = formatter(v);
        }
      });
      prevValue.current = value;
      return controls.stop;
    }
  }, [value, duration, formatter, isInView, reducedMotion]);

  return <span ref={ref} className={className}>{formatter(value)}</span>;
}
