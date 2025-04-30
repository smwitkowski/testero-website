import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpenIcon, ClipboardIcon, TrendingUpIcon } from "lucide-react";

const ExamPrepRecommendations: React.FC = () => {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Exam Prep Recommendations</CardTitle>
        <CardDescription>
          Based on your performance and progress.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <RecommendationItem
            icon={<BookOpenIcon className="h-6 w-6 text-primary" />}
            title="Review Algebra Concepts"
            description="You've shown weakness in algebra, focus on strengthening these skills."
          />
          <RecommendationItem
            icon={<ClipboardIcon className="h-6 w-6 text-primary" />}
            title="Take Practice Test"
            description="You're due for another practice test, try the latest one."
          />
          <RecommendationItem
            icon={<TrendingUpIcon className="h-6 w-6 text-primary" />}
            title="Review Progress"
            description="Check your overall progress and see where you can improve."
          />
        </div>
      </CardContent>
    </Card>
  );
};

interface RecommendationItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const RecommendationItem: React.FC<RecommendationItemProps> = ({ icon, title, description }) => (
  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
    {icon}
    <div>
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{description}</div>
    </div>
    <Button size="sm" variant="outline">Start</Button>
  </div>
);

export default ExamPrepRecommendations;