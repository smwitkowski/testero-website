import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ProgressChart, SectionScoreChart } from "@/components/dashboard/Charts";

interface OverviewChartsProps {
  progressData: { date: string; score: number }[];
  sectionScoreData: { section: string; score: number }[];
  progressChartConfig: {
    score: {
      label: string;
      color: string;
    };
  };
}

const OverviewCharts: React.FC<OverviewChartsProps> = ({ progressData, sectionScoreData, progressChartConfig }) => {
  return (
    <div className="grid gap-6 md:grid-cols-2 space-y-6 md:space-y-0">
      <Card>
        <CardHeader>
          <CardTitle>Progress Over Time</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          {progressData.length > 0 ? (
            <ProgressChart
              data={progressData}
              config={progressChartConfig}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">
                Take more tests to see your progress over time.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Section Scores</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          {sectionScoreData.length > 0 ? (
            <SectionScoreChart data={sectionScoreData} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">
                Complete tests to see your section scores.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewCharts;