import ExamPrepProgress from "./ExamPrepProgress";
import StatCard from "./StatCard";
import OverviewCharts from "./OverviewCharts";
import ExamPrepRecommendations from "./ExamPrepRecommendations";

export default function DashboardOverview({ data }) {
  const progressChartConfig = {
    score: {
      label: "Score",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <ExamPrepProgress />
        <StatCard
          title="Practice Tests Completed"
          value="12"
          description="+3 from last week"
          progress={75}
          progressLabel="75% of practice tests completed"
        />
        <StatCard
          title="Study Time"
          value="45 hrs"
          description="+5 hrs from last week"
          progress={80}
          progressLabel="80% of study time target"
        />
      </div>
      <OverviewCharts
        progressData={data.progressData}
        sectionScoreData={data.sectionScoreData}
        progressChartConfig={progressChartConfig}
      />
      <ExamPrepRecommendations />
    </div>
  );
}
