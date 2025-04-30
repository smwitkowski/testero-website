import { useState, useCallback } from 'react';

export function useDashboardData() {
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    progressData: [],
    sectionScoreData: [],
    testSummary: [],
  });

  const fetchDashboardData = useCallback(async (supabase: any, userId: string) => {
    setIsLoading(true);
    
    // Fetch progress data
    const { data: progressData } = await supabase
      .from("progress_over_time")
      .select("date, average_score")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    // Fetch section scores
    const { data: sectionData } = await supabase
      .from("section_scores")
      .select("section_name, average_score")
      .eq("user_id", userId)
      .order("section_name", { ascending: true });

    // Fetch practice test summary
    const { data: testSummaryData } = await supabase
      .from("practice_test_summary")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(5);

    setDashboardData({
      progressData: progressData.map(({ date, average_score }) => ({
        date: new Date(date).toLocaleString("default", { month: "short" }),
        score: Math.round(average_score),
      })),
      sectionScoreData: sectionData.map(({ section_name, average_score }) => ({
        section: section_name,
        score: Math.round(average_score),
      })),
      testSummary: testSummaryData,
    });

    setIsLoading(false);
  }, []);

  return { isLoading, dashboardData, fetchDashboardData };
}