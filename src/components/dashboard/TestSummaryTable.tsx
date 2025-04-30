import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface TestSummary {
  id: number;
  date: string;
  score: number;
  time_spent: number;
  status: string;
}

interface TestSummaryTableProps {
  testSummary: TestSummary[] | null;
}

export default function TestSummaryTable({ testSummary }: TestSummaryTableProps) {
  if (!testSummary || testSummary.length === 0) {
    return <p>No test summary data available.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Test</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {testSummary.map((test) => (
          <TableRow key={test.id}>
            <TableCell>{`Practice Test ${test.id}`}</TableCell>
            <TableCell>{new Date(test.date).toLocaleString()}</TableCell>
            <TableCell>{test.score}%</TableCell>
            <TableCell>{test.time_spent}m</TableCell>
            <TableCell>{test.status}</TableCell>
            <TableCell>
              <Button size="sm">Review</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}