import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import TestSummaryTable from "./TestSummaryTable";

export default function DashboardPracticeTests({ testSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice Tests</CardTitle>
        <CardDescription>
          Review your performance on practice tests.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TestSummaryTable testSummary={testSummary} />
      </CardContent>
    </Card>
  );
}