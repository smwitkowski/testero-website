import Link from "next/link";
import { ToolPage } from "@/components/tools/tool-page";
import { CertAction } from "@/components/tools/cert-action";
import { TrackerEvents } from "@/components/tools/tracker-events";
import { certifications } from "@/lib/certifications/catalog";
import { getCertification, checkedDate, fact, label } from "@/lib/certifications/data";
import { tools } from "@/lib/tools/pages";
import { pageMetadata } from "@/lib/seo";
const tool = tools.find(tool => tool.slug === "exam-guide-changes")!;
export const metadata = pageMetadata(tool.title, tool.description, `/tools/${tool.slug}`);
export default function Page() {
  return <ToolPage slug={tool.slug} copy={<><h2 className="text-2xl font-semibold text-foreground">What this tracker can tell you</h2>
<p className="leading-7">Exam preparation starts with the guide you will actually be assessed against. This tracker brings together the current guide records, exam variants, announcements and upcoming versions from our Google Cloud certification registry. Each credential links to Google&apos;s certification page and each stored guide links to its official source. Bookmark this page as a starting point before you book or revise your study plan.</p>
<p className="leading-7">A guide version, an effective date and an as-of date mean different things. An effective date describes when a guide applies; an as-of date describes the document snapshot. When Google does not state a version or date in the registry, we show that gap rather than infer one from a filename. Standard, renewal and beta guides are listed separately. A beta guide marked current does not mean general registration is open.</p>
<p className="leading-7">The last-checked dates describe our stored source checks, not a live monitoring service. Later checks of recommended experience do not refresh guide or announcement dates. An upcoming branding change without a new guide link is still an announcement, not a replacement outline. Likewise, no recorded retirement notice does not prove an exam cannot retire. Follow the official links for the latest information, and recheck your chosen guide close to exam day. Testero does not provide Google&apos;s registration service.</p></>}>
    <TrackerEvents />
    <p className="rounded-lg border border-border bg-card p-5 leading-7 text-body">Registry snapshot, not live monitoring. Each guide and announcement has a stored source-check date below. Check Google before booking; later experience-only checks do not update these dates.</p>
    <nav aria-label="Jump to certification" className="flex flex-wrap gap-x-5 gap-y-2 border-y border-border py-4 text-sm">{certifications.map(cert => <a key={cert.cert_id} className="py-2 text-primary underline" href={`#${cert.cert_id}`}>{cert.name}</a>)}</nav>
    <div className="space-y-8">{certifications.map(entry => {
      const cert = getCertification(entry.cert_id)!;
      return <section key={cert.cert_id} id={cert.cert_id} className="scroll-mt-6 space-y-5 rounded-lg border border-border bg-card p-5 sm:p-8">
        <header className="space-y-3"><h2 className="text-2xl font-semibold"><Link href={`/certifications/${cert.cert_id}`} className="text-primary underline">{cert.name}</Link></h2><p className="text-sm text-muted-foreground">Certification and announcements last checked <time dateTime={checkedDate(cert).slice(0, 10)}>{checkedDate(cert).slice(0, 10)}</time>. Registration: {label(cert.registration_status)}.</p><a href={cert.cert_url} className="inline-block py-2 text-primary underline">Official certification page</a></header>
        <div className="space-y-5">{cert.guides.map(guide => {
          const checked = cert.sources.filter(source => source.role === "exam_guide" && source.url === guide.url).map(source => source.retrieved_at).sort().at(-1)?.slice(0, 10);
          return <section key={guide.url} className="space-y-3 border-t border-border pt-4"><h3 className="text-lg font-semibold">{label(guide.variant)} guide · {guide.status ?? "status not stated"}</h3><dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">{[["Version", fact(guide.version)], ["Effective date", fact(guide.effective_date)], ["Guide as-of date", fact(guide.as_of_date)], ["Guide last checked", checked ?? "Not recorded"]].map(([key, value]) => <div key={key}><dt className="font-semibold">{key}</dt><dd className="mt-1 text-body">{value}</dd></div>)}</dl><a href={guide.url} className="inline-block py-2 text-primary underline">Official {guide.variant} exam guide</a></section>;
        })}</div>
        <section className="space-y-3 border-t border-border pt-4"><h3 className="font-semibold">Announcements</h3>{cert.announcements.length ? <ul className="list-disc space-y-3 pl-5 leading-7 text-body">{cert.announcements.map(text => <li key={text}>{text}</li>)}</ul> : <p className="text-sm text-body">No announcements recorded in this snapshot.</p>}</section>
        <section className="space-y-3 border-t border-border pt-4"><h3 className="font-semibold">Upcoming versions</h3>{cert.upcoming_versions.length ? cert.upcoming_versions.map((version, i) => <dl key={i} className="space-y-3 text-sm">{Object.entries(version).map(([key, value]) => <div key={key}><dt className="font-semibold">{label(key)}</dt><dd className="mt-1 leading-relaxed text-body">{typeof value === "string" && /^https:\/\//.test(value) ? <a href={value} className="text-primary underline">{key === "guide_url" ? "Official future guide" : "Official announcement source"}</a> : fact(value)}</dd></div>)}</dl>) : <p className="text-sm text-body">No upcoming version recorded. This does not rule out future changes.</p>}</section>
        <p className="text-sm text-body"><strong>Retirement:</strong> {cert.retirement ? fact(cert.retirement) : "No retirement notice recorded; not proof of continued availability."}</p>
        <details><summary className="cursor-pointer py-3 font-semibold text-primary">{cert.cert_id === "machine-learning-engineer" ? "Try the PMLE diagnostic" : "Get notified about this diagnostic"}</summary><div className="pt-3"><CertAction certId={cert.cert_id} certName={cert.name} /></div></details>
      </section>;
    })}</div>
  </ToolPage>;
}
