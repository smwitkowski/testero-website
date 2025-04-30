"use client";
import { createBrowserClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { SignUpForm } from "@/components/SignUpForm";
import { SignUpLinks } from "@/components/SignUpLinks";

const HeroImage = dynamic(
  () => import("@/components/HeroImage").then((mod) => mod.HeroImage),
  {
    ssr: false,
  }
);

export default async function SignUpPage() {
  const supabase = createBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
      <HeroImage />
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <h1 className="mb-4 text-3xl font-bold">Sign Up</h1>
          <SignUpForm />
          <SignUpLinks />
        </div>
      </div>
    </div>
  );
}