"use client";

import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

interface ScrollAnimationProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  stagger?: boolean;
}

export function ScrollAnimation({
  children,
  className = "",
  delay = 0,
  direction = "up",
  stagger = false,
}: ScrollAnimationProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const sync = () => setShouldReduceMotion(mediaQuery.matches);
    sync();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", sync);
      return () => mediaQuery.removeEventListener("change", sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    if (shouldReduceMotion) return;
    if (isInView) return;

    const node = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setIsInView(true);
        observer.disconnect();
      },
      {
        root: null,
        rootMargin: "-50px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isInView, shouldReduceMotion]);

  const initialTransform = useMemo(() => {
    switch (direction) {
      case "up":
        return "translate3d(0, 30px, 0)";
      case "down":
        return "translate3d(0, -30px, 0)";
      case "left":
        return "translate3d(30px, 0, 0)";
      case "right":
        return "translate3d(-30px, 0, 0)";
      default:
        return "translate3d(0, 30px, 0)";
    }
  }, [direction]);

  const baseStyle: React.CSSProperties = useMemo(
    () => ({
      opacity: isInView ? 1 : 0,
      transform: isInView ? "translate3d(0, 0, 0)" : initialTransform,
      filter: isInView ? "blur(0px)" : "blur(4px)",
      transitionProperty: "opacity, transform, filter",
      transitionDuration: "600ms",
      transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
      willChange: "opacity, transform, filter",
    }),
    [initialTransform, isInView]
  );

  if (shouldReduceMotion) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  if (stagger) {
    const childrenArray = React.Children.toArray(children);
    const step = 0.1;

    return (
      <div ref={ref} className={className}>
        {childrenArray.map((child, index) => (
          <div
            key={index}
            style={{
              ...baseStyle,
              transitionDelay: `${Math.max(0, delay) + index * step}s`,
            }}
          >
            {child}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...baseStyle,
        transitionDelay: `${Math.max(0, delay)}s`,
      }}
    >
      {children}
    </div>
  );
}
