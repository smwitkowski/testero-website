import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { getPaidAccess } from "@/lib/billing/paid-access";
import { LogoutButton } from "@/components/logout-button";
import { BillingAccount } from "@/components/billing-account";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const user = await requireUser("/account");
  const access = await getPaidAccess(user.id);
  return <div className="mx-auto max-w-2xl space-y-8">
    <header className="space-y-3"><h1 className="text-3xl font-semibold tracking-tight">Your account</h1><p className="break-words text-muted-foreground">{user.email}</p></header>
    <BillingAccount access={access} />
    <div className="flex flex-wrap gap-3 border-t border-border pt-5"><Button variant="outline" asChild><Link href="/dashboard">Back to dashboard</Link></Button><LogoutButton /></div>
  </div>;
}
