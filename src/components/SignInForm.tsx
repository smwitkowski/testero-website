"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { useRouter } from "next/navigation";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createBrowserClient();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      if (error) throw error;
      // Redirect to dashboard without exposing any tokens or codes in the URL
      router.push("/dashboard");
    } catch (error) {
      console.error("Error signing in:", error);
      // Handle error (e.g., show error message to user)
    }
  };

  const handleGoogleSignIn = async () => {
    const supabase = createBrowserClient();
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      if (error) throw error;
      // The user will be redirected to Google's OAuth page.
      // After authentication, they'll be sent back to our callback route.
    } catch (error) {
      console.error("Error signing in with Google:", error);
      // Handle error (e.g., show error message to user)
    }
  };

  return (
    <form onSubmit={handleEmailSignIn} className="space-y-4">
      <div className="text-left">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="text-left">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full">
        Sign In
      </Button>
      <div className="flex flex-col space-y-2">
        <GoogleSignInButton onClick={handleGoogleSignIn} />
      </div>
    </form>
  );
}
