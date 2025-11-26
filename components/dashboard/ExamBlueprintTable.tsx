"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DomainStat {
  domainCode: string;
  questionsAnswered: number;
  totalQuestions: number;
  accuracy: number;
}

export interface ExamBlueprintTableProps {
  domainStats: DomainStat[];
  className?: string;
}

export const ExamBlueprintTable: React.FC<ExamBlueprintTableProps> = ({
  domainStats,
  className,
}) => {
  // Create a map of domain stats by domain code
  const statsMap = useMemo(() => {
    const map = new Map<string, DomainStat>();
    domainStats.forEach((stat) => {
      map.set(stat.domainCode, stat);
    });
    return map;
  }, [domainStats]);

  // Calculate overall coverage and accuracy
  const { coverage, overallAccuracy } = useMemo(() => {
    const totalAnswered = domainStats.reduce((sum, stat) => sum + stat.questionsAnswered, 0);
    const totalPossible = domainStats.reduce((sum, stat) => sum + stat.totalQuestions, 0);
    const coverage = totalPossible > 0 ? Math.round((totalAnswered / totalPossible) * 100) : 0;

    const weightedAccuracy = domainStats.reduce((sum, stat) => {
      const weight = stat.totalQuestions > 0 ? stat.questionsAnswered / totalAnswered : 0;
      return sum + stat.accuracy * weight;
    }, 0);
    const overallAccuracy = Math.round(weightedAccuracy);

    return { coverage, overallAccuracy };
  }, [domainStats]);

  // Prepare table data
  const tableData = useMemo(() => {
    return PMLE_BLUEPRINT.map((domain) => {
      const stat = statsMap.get(domain.domainCode);
      return {
        domain: domain.displayName,
        weight: Math.round(domain.weight * 100),
        questionsAnswered: stat
          ? `${stat.questionsAnswered}/${stat.totalQuestions}`
          : "0/0",
        accuracy: stat ? stat.accuracy : 0,
        status: stat && stat.accuracy >= 80 ? "mastered" : "practice",
        domainCode: domain.domainCode,
      };
    });
  }, [statsMap]);

  const columns = [
    {
      id: "domain",
      header: "DOMAIN",
      accessor: (row: typeof tableData[0]) => (
        <span className="font-medium">{row.domain}</span>
      ),
    },
    {
      id: "weight",
      header: "WEIGHT",
      accessor: (row: typeof tableData[0]) => <span>{row.weight}%</span>,
      align: "right" as const,
    },
    {
      id: "questionsAnswered",
      header: "QUESTIONS ANSWERED",
      accessor: (row: typeof tableData[0]) => <span>{row.questionsAnswered}</span>,
      align: "right" as const,
    },
    {
      id: "accuracy",
      header: "ACCURACY",
      accessor: (row: typeof tableData[0]) => (
        <span
          className={cn(
            "font-semibold",
            row.accuracy >= 80
              ? "text-success"
              : row.accuracy >= 60
              ? "text-warning"
              : "text-error"
          )}
        >
          {row.accuracy}%
        </span>
      ),
      align: "right" as const,
    },
    {
      id: "status",
      header: "STATUS",
      accessor: (row: typeof tableData[0]) => {
        if (row.status === "mastered") {
          return (
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-success" />
              <Badge variant="soft" tone="success" size="sm">
                Mastered
              </Badge>
            </div>
          );
        }
        return (
          <Link
            href={`/practice/question?domain=${encodeURIComponent(row.domain)}`}
            className="text-accent hover:underline font-medium"
          >
            Practice
          </Link>
        );
      },
      align: "left" as const,
    },
  ];

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Exam Blueprint</CardTitle>
          <div className="text-sm text-muted-foreground">
            {coverage}% covered {overallAccuracy}% accuracy
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table
          columns={columns}
          data={tableData}
          density="compact"
          getRowId={(row) => row.domainCode}
        />
      </CardContent>
    </Card>
  );
};

