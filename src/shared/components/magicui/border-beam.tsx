"use client";

import { cn } from "@/shared/lib/utils";

interface BorderBeamProps {
  /**
   * The size of the border beam.
   */
  size?: number;
  /**
   * The duration of the border beam.
   */
  duration?: number;
  /**
   * The delay of the border beam.
   */
  delay?: number;
  /**
   * The color of the border beam from.
   */
  colorFrom?: string;
  /**
   * The color of the border beam to.
   */
  colorTo?: string;
  /**
   * The motion transition of the border beam.
   */
  transition?: unknown;
  /**
   * The class name of the border beam.
   */
  className?: string;
  /**
   * The style of the border beam.
   */
  style?: React.CSSProperties;
  /**
   * Whether to reverse the animation direction.
   */
  reverse?: boolean;
  /**
   * The initial offset position (0-100).
   */
  initialOffset?: number;
  /**
   * The border width of the beam.
   */
  borderWidth?: number;
}

export const BorderBeam = ({
  className,
  size = 50,
  delay = 0,
  duration = 6,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  transition: _transition,
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1,
}: BorderBeamProps) => {
  const normalizedOffset = Math.max(0, Math.min(100, initialOffset));
  const progress = reverse
    ? (100 - normalizedOffset) / 100
    : normalizedOffset / 100;
  const animationDelay = -(delay + duration * progress);

  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)] border-(length:--border-beam-width)"
      style={
        {
          "--border-beam-width": `${borderWidth}px`,
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          "absolute animate-spin rounded-[inherit] motion-reduce:hidden",
          "bg-[conic-gradient(from_0deg,transparent,var(--color-from),var(--color-to),transparent)]",
          className
        )}
        style={
          {
            inset: `${-Math.max(0, size)}px`,
            "--color-from": colorFrom,
            "--color-to": colorTo,
            animationDuration: `${duration}s`,
            animationDelay: `${animationDelay}s`,
            animationDirection: reverse ? "reverse" : "normal",
            ...style,
          } as React.CSSProperties
        }
      />
    </div>
  );
};
