"use client";

import { cn } from "@/lib/utils";

interface MarqueeProps {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children?: React.ReactNode;
  vertical?: boolean;
  repeat?: number;
  speed?: "slow" | "normal" | "fast";
}

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  speed = "normal",
  ...props
}: MarqueeProps) {
  const speedDuration = {
    slow: "60s",
    normal: "40s", 
    fast: "20s"
  };

  return (
    <div
      {...props}
      className={cn(
        "group flex overflow-hidden p-2 [gap:1rem]",
        {
          "flex-row": !vertical,
          "flex-col": vertical,
        },
        className,
      )}
      style={
        {
          "--duration": speedDuration[speed],
          "--gap": "1rem",
        } as React.CSSProperties
      }
    >
      {Array(repeat)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            className={cn("flex shrink-0 justify-around", {
              "animate-marquee flex-row [gap:var(--gap)]": !vertical,
              "animate-marquee-vertical flex-col [gap:var(--gap)]": vertical,
              "group-hover:[animation-play-state:paused]": pauseOnHover,
              "[animation-direction:reverse]": reverse,
            })}
          >
            {children}
          </div>
        ))}
    </div>
  );
}