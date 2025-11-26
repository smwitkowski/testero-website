"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Star, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Activity {
  type: "exam_completed" | "domain_mastered" | "quiz_completed";
  title: string;
  score?: number;
  timestamp: Date;
}

export interface RecentActivityListProps {
  activities: Activity[];
  className?: string;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  
  const minutes = Math.floor(diffInSeconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  
  const hours = Math.floor(diffInSeconds / 3600);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  
  const days = Math.floor(diffInSeconds / 86400);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getActivityIcon(type: Activity["type"]) {
  switch (type) {
    case "exam_completed":
    case "quiz_completed":
      return <CheckCircle2 className="w-5 h-5 text-success" />;
    case "domain_mastered":
      return <Star className="w-5 h-5 text-accent" />;
    default:
      return <Clock className="w-5 h-5 text-muted-foreground" />;
  }
}

export const RecentActivityList: React.FC<RecentActivityListProps> = ({
  activities,
  className,
}) => {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No recent activity
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    {activity.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{formatRelativeTime(activity.timestamp)}</span>
                    {activity.score !== undefined && (
                      <>
                        <span>•</span>
                        <span>Scored {activity.score}%</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

