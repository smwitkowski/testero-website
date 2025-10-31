import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DomainBreakdown as DomainBreakdownType } from "./types";

type Tone = "success" | "warning" | "danger";

const percentageTone = (percentage: number): Tone => {
  if (percentage >= 70) return "success";
  if (percentage >= 50) return "warning";
  return "danger";
};

const toneTextClass: Record<Tone, string> = {
  success: "text-[color:var(--tone-success)]",
  warning: "text-[color:var(--tone-warning)]",
  danger: "text-[color:var(--tone-danger)]",
};

const toneBadgeClass: Record<Tone, string> = {
  success: "bg-[color:var(--tone-success-surface)] text-[color:var(--tone-success)]",
  warning: "bg-[color:var(--tone-warning-surface)] text-[color:var(--tone-warning)]",
  danger: "bg-[color:var(--tone-danger-surface)] text-[color:var(--tone-danger)]",
};

const toneBarClass: Record<Tone, string> = {
  success: "bg-[color:var(--tone-success)]",
  warning: "bg-[color:var(--tone-warning)]",
  danger: "bg-[color:var(--tone-danger)]",
};

const toneBarFill: Record<Tone, string> = {
  success: "var(--tone-success)",
  warning: "var(--tone-warning)",
  danger: "var(--tone-danger)",
};

interface DomainBreakdownProps {
  domains: DomainBreakdownType[];
  onDomainClick?: (domain: string) => void;
  viewMode?: "chart" | "list";
  compact?: boolean;
  showSuggestions?: boolean;
  showBadges?: boolean;
}

export const DomainBreakdown: React.FC<DomainBreakdownProps> = ({
  domains,
  onDomainClick,
  viewMode = "chart",
  compact = false,
  showSuggestions = false,
  showBadges = false,
}) => {
  // Sort domains by percentage (lowest first)
  const sortedDomains = [...domains].sort((a, b) => a.percentage - b.percentage);

  if (domains.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No domain data available</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = sortedDomains.map((domain) => ({
    name: domain.domain,
    percentage: domain.percentage,
    correct: domain.correct,
    total: domain.total,
  }));

  const renderListView = () => (
    <div data-testid="domain-list" className="space-y-3">
      {sortedDomains.map((domain) => (
        <div
          key={domain.domain}
          data-testid={`domain-${domain.domain}`}
          onClick={() => onDomainClick?.(domain.domain)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onDomainClick?.(domain.domain);
            }
          }}
          tabIndex={onDomainClick ? 0 : -1}
          className={cn(
            "rounded-lg border border-[color:var(--divider-color)] bg-[color:var(--surface-elevated)] p-4 md:p-6 transition-colors",
            "hover:bg-[color:var(--surface-subtle)]",
            onDomainClick && "cursor-pointer"
          )}
          aria-label={`${domain.domain}: ${domain.correct} out of ${domain.total} correct`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">{domain.domain}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {domain.correct}/{domain.total}
              </span>
              <span className={cn("font-semibold", toneTextClass[percentageTone(domain.percentage)])}>
                {domain.percentage}%
              </span>
              {domain.percentage < 50 && (
                <span data-testid="weak-domain-indicator" className="sr-only">
                  Weak area
                </span>
              )}
              {showBadges && domain.percentage >= 70 && (
                <span
                  data-testid={`badge-${domain.domain}`}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium",
                    toneBadgeClass[percentageTone(domain.percentage)]
                  )}
                >
                  Strong
                </span>
              )}
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-[color:var(--surface-muted)]">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                toneBarClass[percentageTone(domain.percentage)]
              )}
              style={{ width: `${domain.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  const renderChartView = () => (
    <>
      <ResponsiveContainer width="100%" height={compact ? 200 : 300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} />
          <YAxis domain={[0, 100]} />
          <Tooltip
            formatter={(value: number) => `${value}%`}
            cursor={{ fill: "var(--surface-muted)" }}
          />
          <Legend />
          <Bar dataKey="percentage" name="Score %" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={toneBarFill[percentageTone(entry.percentage)]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 space-y-2">
        {sortedDomains.map((domain) => (
          <div
            key={domain.domain}
            data-testid={`domain-${domain.domain}`}
            onClick={() => onDomainClick?.(domain.domain)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onDomainClick?.(domain.domain);
              }
            }}
            tabIndex={onDomainClick ? 0 : -1}
            className={cn(
              "flex items-center justify-between rounded border border-[color:var(--divider-color)] p-2",
              "hover:bg-[color:var(--surface-subtle)]",
              onDomainClick && "cursor-pointer"
            )}
            aria-label={`${domain.domain}: ${domain.correct} out of ${domain.total} correct`}
          >
            <span className="text-sm">{domain.domain}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {domain.correct}/{domain.total}
              </span>
              <span className="text-sm font-medium">{domain.percentage}%</span>
              {domain.percentage < 50 && (
                <span data-testid="weak-domain-indicator" className="sr-only">
                  Weak area
                </span>
              )}
              {showBadges && domain.percentage >= 70 && (
                <span
                  data-testid={`badge-${domain.domain}`}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium",
                    toneBadgeClass[percentageTone(domain.percentage)]
                  )}
                >
                  Strong
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <Card
      className="w-full"
      data-testid="domain-breakdown-container"
      role="region"
      aria-label="Domain breakdown"
    >
      <CardHeader>
        <CardTitle>Score by Domain</CardTitle>
      </CardHeader>
      <CardContent className={cn("sm:block", compact && "h-48")}>
        {viewMode === "list" ? renderListView() : renderChartView()}

        {showSuggestions && (
          <div className="mt-4 space-y-2">
            {sortedDomains
              .filter((d) => d.percentage < 50)
              .map((domain) => (
                <p key={domain.domain} className="text-sm text-muted-foreground">
                  Focus on {domain.domain} - needs improvement
                </p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
