import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DomainBreakdown as DomainBreakdownType } from "./types";

interface DomainBreakdownProps {
  domains: DomainBreakdownType[];
  onDomainClick?: (domain: string) => void;
  viewMode?: "chart" | "list";
  compact?: boolean;
  showSuggestions?: boolean;
  showBadges?: boolean;
}

function getBarColor(percentage: number): string {
  if (percentage >= 70) return "#22c55e"; // green
  if (percentage >= 50) return "#f59e0b"; // amber
  return "#ef4444"; // red
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
        <CardContent className="text-center py-8">
          <p className="text-gray-500">No domain data available</p>
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
            "p-4 rounded-lg bg-gray-50 hover:bg-gray-50 transition-colors",
            onDomainClick && "cursor-pointer"
          )}
          aria-label={`${domain.domain}: ${domain.correct} out of ${domain.total} correct`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">{domain.domain}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {domain.correct}/{domain.total}
              </span>
              <span
                className={cn(
                  "font-semibold",
                  domain.percentage >= 70 && "text-green-600",
                  domain.percentage >= 50 && domain.percentage < 70 && "text-amber-600",
                  domain.percentage < 50 && "text-red-600"
                )}
              >
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
                  className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded"
                >
                  Strong
                </span>
              )}
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                domain.percentage >= 70 && "bg-green-500",
                domain.percentage >= 50 && domain.percentage < 70 && "bg-amber-500",
                domain.percentage < 50 && "bg-red-500"
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
            cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
          />
          <Legend />
          <Bar dataKey="percentage" name="Score %" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.percentage)} />
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
              "flex items-center justify-between p-2 rounded hover:bg-gray-50",
              onDomainClick && "cursor-pointer"
            )}
            aria-label={`${domain.domain}: ${domain.correct} out of ${domain.total} correct`}
          >
            <span className="text-sm">{domain.domain}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
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
                  className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded"
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
                <p key={domain.domain} className="text-sm text-gray-600">
                  Focus on {domain.domain} - needs improvement
                </p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
