"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { User, Mail, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import Link from "next/link";

const accountFormSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

export default function AccountSettingsPage() {
  const { user, refreshSession } = useAuth();
  const posthog = usePostHog();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      fullName: user?.user_metadata?.full_name || "",
    },
  });

  // Update form when user data changes
  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      form.reset({
        fullName: user.user_metadata.full_name,
      });
    }
  }, [user, form]);

  useEffect(() => {
    if (user && posthog) {
      posthog.capture("settings_viewed", {
        user_id: user.id,
        section: "account",
      });
    }
  }, [user, posthog]);

  const onSubmit = async (data: AccountFormValues) => {
    setIsSubmitting(true);
    setSubmitSuccess(false);
    setSubmitError(null);

    try {
      const response = await fetch("/api/settings/account/name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fullName: data.fullName }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update name");
      }

      setSubmitSuccess(true);
      
      // Refresh session to get updated user metadata
      await refreshSession();

      // Track analytics
      if (posthog) {
        posthog.capture("settings_account_name_updated", {
          user_id: user?.id,
        });
      }

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update name";
      setSubmitError(errorMessage);
      
      if (posthog) {
        posthog.capture("settings_error", {
          user_id: user?.id,
          error: errorMessage,
          section: "account",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const userEmail = user?.email || "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile information and account details
        </p>
      </div>

      {/* Profile Information Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-accent/10">
              <User className="w-5 h-5 text-accent" />
            </div>
            <div>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your display name</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your name"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This name will be displayed throughout the application
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Success Message */}
              {submitSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 border border-green-200">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="text-sm text-green-800">Name updated successfully!</p>
                </div>
              )}

              {/* Error Message */}
              {submitError && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 border border-red-200">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm text-red-800">{submitError}</p>
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting} tone="accent">
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Account Details Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-accent/10">
              <Mail className="w-5 h-5 text-accent" />
            </div>
            <div>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">Email</p>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
            </div>
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          {user?.id && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">User ID</p>
                <p className="text-sm font-mono text-muted-foreground truncate max-w-xs" title={user.id}>
                  {user.id}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">Account Created</p>
              <p className="text-sm text-muted-foreground">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Not available"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-accent/10">
              <Lock className="w-5 h-5 text-accent" />
            </div>
            <div>
              <CardTitle>Security</CardTitle>
              <CardDescription>Manage your password</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Password</p>
              <p className="text-sm text-muted-foreground">
                Last updated: {user?.updated_at ? new Date(user.updated_at).toLocaleDateString() : "Never"}
              </p>
            </div>
            <Link href="/forgot-password">
              <Button variant="outline" tone="neutral">
                Change Password
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
