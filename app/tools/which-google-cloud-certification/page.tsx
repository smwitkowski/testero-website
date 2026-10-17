import { ToolPage } from "@/components/tools/tool-page";
import { toolCertifications } from "@/lib/tools/data";
import { tools } from "@/lib/tools/pages";
import { pageMetadata } from "@/lib/seo";
import { CertificationPicker } from "@/components/tools/picker";
const tool = tools.find(tool => tool.slug === "which-google-cloud-certification")!;
export const metadata = pageMetadata(tool.title, tool.description, `/tools/${tool.slug}`);
export default function Page() {
  return <ToolPage slug={tool.slug} copy={<><h2 className="text-2xl font-semibold text-foreground">How to choose a Google Cloud certification</h2>
<p className="leading-7">Start with the work you want to do, not the longest certification name. This picker compares your role, Google Cloud experience, industry experience, focus and goal with the foundational, associate and professional credentials in our sourced registry. It suggests a starting point and, where useful, an alternative or a longer-term specialty. It does not score your technical knowledge.</p>
<p className="leading-7">Foundational credentials focus on concepts and business decisions. Associate credentials can suit people building practical administration or data skills. Professional credentials target specialist work. These levels are not a mandatory sequence. Read the recommended experience beside each result and compare it with your actual projects. Google Workspace experience, for example, is different from general Google Cloud experience.</p>
<p className="leading-7">Our matching rules are editorial guidance, not Google recommendations about you. Every result links to the certification details and official source so you can inspect the exam scope before committing. A shared link contains only certification IDs, not your answers. No account is needed. Once you have a shortlist, use the study plan builder to budget time and check the guide tracker before booking. A match does not establish readiness, eligibility, job prospects or a likely exam result.</p></>}><CertificationPicker certs={toolCertifications()} /></ToolPage>;
}
