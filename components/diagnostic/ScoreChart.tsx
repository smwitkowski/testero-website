import React from "react";
import { cn } from "@/lib/utils";

interface ScoreChartProps {
  score: number;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
  showStatus?: boolean;
}

type ScoreTone = "success" | "warning" | "error";

const toneClassMap: Record<ScoreTone, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
};

function getScoreTone(score: number): ScoreTone {
  if (score >= 70) return "success";
  if (score >= 50) return "warning";
  return "error";
}

function getScoreStatus(score: number): string {
  if (score >= 90) return "Excellent Performance";
  if (score >= 70) return "Good Progress";
  if (score >= 50) return "Keep Practicing";
  return "Needs Improvement";
}

function getPerformanceLevel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Ready";
  if (score >= 50) return "Good Progress";
  return "Needs Work";
}

export const ScoreChart: React.FC<ScoreChartProps> = ({
  score,
  size = "md",
  animated = true,
  className,
  showStatus = false,
}) => {
  // Clamp score between 0 and 100
  const clampedScore = Math.max(0, Math.min(100, score));
  const displayScore = Math.round(clampedScore);

  // Size configurations
  const sizeConfig = {
    sm: { width: 80, height: 80, strokeWidth: 6, fontSize: "text-xl" },
    md: { width: 128, height: 128, strokeWidth: 8, fontSize: "text-3xl" },
    lg: { width: 192, height: 192, strokeWidth: 10, fontSize: "text-5xl" },
  };

  const config = sizeConfig[size];
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;
  const tone = getScoreTone(displayScore);
  const toneClass = toneClassMap[tone];
  const performanceLevel = getPerformanceLevel(displayScore);

  // Size classes for the container
  const sizeClasses = {
    sm: "w-20 h-20",
    md: "w-32 h-32",
    lg: "w-48 h-48",
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <div
        data-testid="score-chart"
        className={cn(sizeClasses[size], "relative", className)}
        role="img"
        aria-label={`Score chart showing ${displayScore}% - ${performanceLevel}`}
      >
        <svg
          width={config.width}
          height={config.height}
          viewBox={`0 0 ${config.width} ${config.height}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            data-testid="background-circle"
            cx={config.width / 2}
            cy={config.height / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            fill="transparent"
            className="text-muted"
          />
          {/* Progress circle */}
          <circle
            data-testid="progress-circle"
            cx={config.width / 2}
            cy={config.height / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={animated ? circumference : strokeDashoffset}
            strokeLinecap="round"
            className={cn(
              animated ? "transition-all duration-1000 ease-out" : "",
              toneClass,
            )}
            style={{
              strokeDashoffset: animated ? strokeDashoffset : undefined,
            }}
          />
        </svg>
        {/* Percentage text in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(config.fontSize, "font-bold", toneClass)}
            aria-live="polite"
            aria-atomic="true"
          >
            {displayScore}%
          </span>
        </div>
      </div>
      {showStatus && (
        <div className="text-center mt-2">
          <span className={cn("text-sm font-medium", toneClass)}>
            {getScoreStatus(displayScore)}
          </span>
        </div>
      )}
    </div>
  );
};
