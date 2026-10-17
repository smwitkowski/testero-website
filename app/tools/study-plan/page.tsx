import { ToolPage } from "@/components/tools/tool-page";
import { toolCertifications } from "@/lib/tools/data";
import { tools } from "@/lib/tools/pages";
import { pageMetadata } from "@/lib/seo";
import { StudyPlanner } from "@/components/tools/study-planner";
const tool = tools.find(tool => tool.slug === "study-plan")!;
export const metadata = pageMetadata(tool.title, tool.description, `/tools/${tool.slug}`);
export default function Page() {
  return <ToolPage slug={tool.slug} copy={<><h2 className="text-2xl font-semibold text-foreground">Turn an exam guide into a weekly routine</h2>
<p className="leading-7">Choose a certification, a future exam date and the hours you can realistically study each week. The builder distributes that time across the included sections of the official standard exam guide. If a certification has only a beta guide, that is clearly labelled. Renewal outlines and separate lab requirements are not covered by this schedule. Always check which assessment you are booking.</p>
<p className="leading-7">Section weights set relative time shares, not a prediction of how many questions you will see. Some approximate official weights total more than 100 percent; the builder preserves those figures and divides time by their sum. If complete weights are unavailable, it splits time evenly and says so. A short final week receives proportionally less time. The exam day itself is excluded, and time is rounded to whole minutes.</p>
<p className="leading-7">For each scheduled section, read the objectives, use official documentation and try practical work. Keep a list of tasks you cannot yet explain or complete, then move time toward those gaps. The schedule follows guide order; it does not know your strengths. Copy the text into your own notes or print the page. Your date and study hours stay in your browser and are not sent in tool analytics. A time budget alone does not show exam readiness.</p></>}><StudyPlanner certs={toolCertifications()} /></ToolPage>;
}
