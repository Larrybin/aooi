"use client";

import {
  ComponentPropsWithoutRef,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { motion } from "motion/react";

import { cn } from "@/shared/lib/utils";

export interface AnimatedGridPatternProps
  extends ComponentPropsWithoutRef<"svg"> {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  strokeDasharray?: ComponentPropsWithoutRef<"path">["strokeDasharray"];
  numSquares?: number;
  maxOpacity?: number;
  duration?: number;
}

type Dimensions = { width: number; height: number };
type Square = { id: number; pos: [number, number] };

function getRandomPos(
  dimensions: Dimensions,
  cellWidth: number,
  cellHeight: number
): [number, number] {
  return [
    Math.floor((Math.random() * dimensions.width) / cellWidth),
    Math.floor((Math.random() * dimensions.height) / cellHeight),
  ];
}

function generateSquares(
  count: number,
  dimensions: Dimensions,
  cellWidth: number,
  cellHeight: number
): Square[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    pos: getRandomPos(dimensions, cellWidth, cellHeight),
  }));
}

export function AnimatedGridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = 0,
  numSquares = 50,
  className,
  maxOpacity = 0.5,
  duration = 4,
  ...props
}: AnimatedGridPatternProps) {
  const id = useId();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [squares, setSquares] = useState<Square[]>(() =>
    generateSquares(numSquares, { width: 0, height: 0 }, width, height)
  );

  // Function to update a single square's position
  const updateSquarePosition = (id: number) => {
    setSquares((currentSquares) =>
      currentSquares.map((sq) =>
        sq.id === id
          ? {
              ...sq,
              pos: getRandomPos(dimensions, width, height),
            }
          : sq
      )
    );
  };

  // Resize observer to update container dimensions
  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const nextDimensions = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        };

        setDimensions(nextDimensions);

        if (nextDimensions.width && nextDimensions.height) {
          setSquares(
            generateSquares(numSquares, nextDimensions, width, height)
          );
        }
      }
    });

    const container = containerRef.current;
    if (container) {
      resizeObserver.observe(container);
    }

    return () => {
      if (container) {
        resizeObserver.unobserve(container);
      }
    };
  }, [containerRef, numSquares, width, height]);

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-gray-400/30 stroke-gray-400/30",
        className
      )}
      {...props}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <path
            d={`M.5 ${height}V.5H${width}`}
            fill="none"
            strokeDasharray={strokeDasharray}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
      <svg x={x} y={y} className="overflow-visible">
        {squares.map(({ pos: [x, y], id }, index) => (
          <motion.rect
            initial={{ opacity: 0 }}
            animate={{ opacity: maxOpacity }}
            transition={{
              duration,
              repeat: 1,
              delay: index * 0.1,
              repeatType: "reverse",
            }}
            onAnimationComplete={() => updateSquarePosition(id)}
            key={`${x}-${y}-${index}`}
            width={width - 1}
            height={height - 1}
            x={x * width + 1}
            y={y * height + 1}
            fill="currentColor"
            strokeWidth="0"
          />
        ))}
      </svg>
    </svg>
  );
}
