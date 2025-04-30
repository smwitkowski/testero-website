import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  progress: number;
  progressLabel: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, description, progress, progressLabel }) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-4xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground">
          {description}
        </div>
      </CardContent>
      <CardFooter>
        <Progress
          value={progress}
          aria-label={progressLabel}
        />
      </CardFooter>
    </Card>
  );
};

export default StatCard;