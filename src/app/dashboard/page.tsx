"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/Sidebar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import DashboardPracticeTests from "@/components/dashboard/DashboardPracticeTests";
import DashboardStudyMaterials from "@/components/dashboard/DashboardStudyMaterials";
import { useDashboardData } from "@/hooks/useDashboardData";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const { isLoading, dashboardData, fetchDashboardData } = useDashboardData();

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        redirect("/signin");
      } else {
        setUser(user);
        await fetchDashboardData(supabase, user.id);
      }
    };

    checkUser();
  }, [fetchDashboardData]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-background">
      {user && (
        <>
          <DashboardSidebar user={user} />
          <div className="flex-1 overflow-auto">
            <div className="grid gap-6 p-6">
              <Tabs defaultValue="overview" className="w-full">
                <div className="flex items-center mb-6">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="practice-tests">
                      Practice Tests
                    </TabsTrigger>
                    <TabsTrigger value="study-materials">
                      Study Materials
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="overview">
                  <DashboardOverview data={dashboardData} />
                </TabsContent>
                <TabsContent value="practice-tests">
                  <DashboardPracticeTests
                    testSummary={dashboardData.testSummary}
                  />
                </TabsContent>
                <TabsContent value="study-materials">
                  <DashboardStudyMaterials />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
