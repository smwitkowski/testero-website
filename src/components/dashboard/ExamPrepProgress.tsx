import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpenIcon, ClipboardIcon, TrendingUpIcon } from "lucide-react";

const ExamPrepProgress: React.FC = () => {
  return (
    <Card className="sm:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle>Exam Prep Progress</CardTitle>
        <CardDescription>
          Review your overall progress and areas to focus on.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          <ProgressItem
            icon={<TrendingUpIcon className="h-6 w-6 text-primary" />}
            title="Overall Progress"
            description="You're making good progress, keep it up!"
            buttonText="View Details"
          />
          <ProgressItem
            icon={<BookOpenIcon className="h-6 w-6 text-primary" />}
            title="Strengths"
            description="You're excelling in verbal reasoning and critical thinking."
            buttonText="Review"
          />
          <ProgressItem
            icon={<ClipboardIcon className="h-6 w-6 text-primary" />}
            title="Areas to Improve"
            description="Focus on strengthening your math skills and problem-solving."
            buttonText="Practice"
          />
        </div>
      </CardContent>
    </Card>
  );
};

interface ProgressItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
}

const ProgressItem: React.FC<ProgressItemProps> = ({ icon, title, description, buttonText }) => (
  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
    {icon}
    <div>
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{description}</div>
    </div>
    <Button size="sm" variant="outline">{buttonText}</Button>
  </div>
);

export default ExamPrepProgress;