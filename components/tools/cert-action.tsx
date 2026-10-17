import Link from "next/link";
import { CertWaitlistForm } from "@/components/cert-waitlist-form";
import { PMLE_CERT_ID } from "@/lib/certifications/catalog";

export function CertAction({ certId, certName }: { certId: string; certName: string }) {
  return <aside className="rounded-lg border border-border bg-card p-5 print:hidden" aria-label={`${certName} diagnostic`}>
    {certId === PMLE_CERT_ID ? <div className="space-y-3"><h3 className="text-lg font-semibold">Check your PMLE readiness</h3><p className="text-body">Get a domain breakdown from the free 20-question PMLE diagnostic.</p><Link href="/diagnostic" className="inline-flex min-h-12 items-center rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary-hover">Start PMLE diagnostic</Link></div> : <CertWaitlistForm certId={certId} certName={certName} />}
  </aside>;
}
