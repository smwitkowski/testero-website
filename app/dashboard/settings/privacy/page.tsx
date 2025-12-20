"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Trash2, AlertTriangle, Mail } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function PrivacySettingsPage() {
  const { user } = useAuth();
  const posthog = usePostHog();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (user && posthog) {
      posthog.capture(ANALYTICS_EVENTS.SETTINGS_VIEWED, {
        user_id: user.id,
        section: "privacy",
      });
    }
  }, [user, posthog]);

  const handleDeleteAccountClick = () => {
    if (posthog && user) {
      posthog.capture(ANALYTICS_EVENTS.SETTINGS_DELETE_ACCOUNT_CLICKED, {
        user_id: user.id,
      });
    }
    setDeleteDialogOpen(true);
  };

  const handleDeleteAccountConfirm = () => {
    if (!user) return;

    const userEmail = user.email || "unknown";
    const userId = user.id;
    const subject = encodeURIComponent("Account Deletion Request");
    const body = encodeURIComponent(
      `Hello,\n\nI would like to delete my Testero account.\n\nUser ID: ${userId}\nEmail: ${userEmail}\n\nPlease proceed with the account deletion.\n\nThank you.`
    );

    const mailtoLink = `mailto:support@testero.com?subject=${subject}&body=${body}`;
    const newWindow = window.open(mailtoLink, "_blank", "noopener,noreferrer");
    if (newWindow) {
      newWindow.opener = null;
    } else {
      // Fallback if popup is blocked
      window.location.href = mailtoLink;
    }

    setDeleteDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Privacy & Data</h1>
        <p className="text-muted-foreground">
          Manage your data and account privacy settings
        </p>
      </div>

      {/* Data Management Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-accent/10">
              <Shield className="w-5 h-5 text-accent" />
            </div>
            <div>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Control your personal data</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Your data is stored securely and used only to provide you with the best learning experience. 
              We respect your privacy and give you control over your information.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">Account Data</p>
                  <p className="text-xs text-muted-foreground">Profile information, email, and preferences</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">Learning Progress</p>
                  <p className="text-xs text-muted-foreground">Diagnostic results, practice sessions, and performance data</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">Billing Information</p>
                  <p className="text-xs text-muted-foreground">Subscription and payment history</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Card */}
      <Card className="border-destructive/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-destructive/10">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-destructive">Delete Account</CardTitle>
              <CardDescription>Permanently delete your account and all associated data</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-md bg-destructive/5 border border-destructive/20">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Warning: This action cannot be undone</p>
                <p className="text-sm text-muted-foreground">
                  Deleting your account will permanently remove all your data, including:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                  <li>Your profile and account information</li>
                  <li>All diagnostic test results and progress</li>
                  <li>Practice session history and performance data</li>
                  <li>Subscription and billing information</li>
                </ul>
              </div>
            </div>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  tone="danger"
                  onClick={handleDeleteAccountClick}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Request Account Deletion
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. All your data, including diagnostic results, practice sessions, 
                    and subscription information will be permanently deleted. You will need to contact support 
                    to complete the deletion process.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccountConfirm}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Contact Support to Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <p className="text-xs text-muted-foreground">
              Account deletion requests are processed manually by our support team to ensure security. 
              You will receive an email confirmation once your account has been deleted.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
