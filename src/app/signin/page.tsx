"use client";
import { useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { SignInForm } from "@/components/SignInForm";
import { SignInLinks } from "@/components/SignInLinks";

const HeroImage = dynamic(
  () => import("@/components/HeroImage").then((mod) => mod.HeroImage),
  {
    ssr: false,
  }
);

export default function SignInPage() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        router.push("/dashboard");
      }
    };

    checkUser();
  }, [router]);

  return (
    <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
      <HeroImage />
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <h1 className="mb-4 text-3xl font-bold">Sign In</h1>
          <SignInForm />
          <SignInLinks />
        </div>
      </div>
    </div>
  );
}