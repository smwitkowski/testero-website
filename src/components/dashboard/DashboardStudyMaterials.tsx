import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function DashboardStudyMaterials() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Study Materials</CardTitle>
        <CardDescription>
          Access your study materials and resources.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Add study materials content here */}
        <p>Study materials content goes here.</p>
      </CardContent>
    </Card>
  );
}