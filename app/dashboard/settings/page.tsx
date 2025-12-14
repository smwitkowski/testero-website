"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, CreditCard, Shield, ArrowRight, Settings as SettingsIcon } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

export default function SettingsOverviewPage() {
  const { user } = useAuth();
  const posthog = usePostHog();

  useEffect(() => {
    if (user && posthog) {
      posthog.capture("settings_viewed", {
        user_id: user.id,
        section: "overview",
      });
    }
  }, [user, posthog]);

  const settingsSections = [
    {
      id: "account",
      title: "Account",
      description: "Manage your profile information, email, and password",
      href: "/dashboard/settings/account",
      icon: User,
    },
    {
      id: "billing",
      title: "Billing & Subscription",
      description: "View your subscription, payment history, and manage billing",
      href: "/dashboard/settings/billing",
      icon: CreditCard,
    },
    {
      id: "privacy",
      title: "Privacy & Data",
      description: "Manage your data and account deletion",
      href: "/dashboard/settings/privacy",
      icon: Shield,
    },
  ];

  const handleSectionClick = (sectionId: string) => {
    if (posthog) {
      posthog.capture("settings_section_clicked", {
        user_id: user?.id,
        section: sectionId,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Settings Sections Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="rounded-lg p-2 bg-accent/10">
                    <Icon className="w-5 h-5 text-accent" />
                  </div>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={section.href} onClick={() => handleSectionClick(section.id)}>
                  <Button variant="outline" tone="neutral" className="w-full" iconRight={<ArrowRight className="w-4 h-4" />}>
                    Manage
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-accent/10">
              <SettingsIcon className="w-5 h-5 text-accent" />
            </div>
            <CardTitle>Account Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium text-foreground">{user?.email || "Not available"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Account Created</span>
            <span className="text-sm font-medium text-foreground">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "Not available"}
            </span>
          </div>
          {user?.id && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">User ID</span>
              <span className="text-sm font-mono text-muted-foreground truncate max-w-xs" title={user.id}>
                {user.id}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
