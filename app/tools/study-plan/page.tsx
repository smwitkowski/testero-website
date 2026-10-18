import { ToolPage } from "@/components/tools/tool-page";
import { toolCertifications } from "@/lib/tools/data";
import { tools } from "@/lib/tools/pages";
import { pageMetadata } from "@/lib/seo";
import { StudyPlanner } from "@/components/tools/study-planner";
const tool = tools.find(tool => tool.slug === "study-plan")!;
export const metadata = pageMetadata(tool.title, tool.description, `/tools/${tool.slug}`);
export default function Page() {
  return <ToolPage slug={tool.slug} copy={<><h2 className="text-2xl font-semibold text-foreground">Turn an exam guide into a weekly routine</h2>
<div className="space-y-2"><h3 className="text-lg font-semibold text-foreground">Choose a realistic budget</h3><p className="leading-7">Select your certification, a future exam date and the hours you can study each week. The schedule follows the official standard guide, or a clearly labelled beta guide. Renewal outlines and separate assessment labs are not included.</p></div>
<div className="space-y-2"><h3 className="text-lg font-semibold text-foreground">Use the plan, then adjust it</h3><p className="leading-7">Read each section’s objectives, use official documentation and try practical work. Keep a list of tasks you cannot explain or complete. Move time toward those gaps; guide order is a starting point, not a personal skills assessment.</p></div>
<div className="space-y-2"><h3 className="text-lg font-semibold text-foreground">Keep a copy</h3><p className="leading-7">Copy the schedule into your notes or print it. Your date and study hours stay in your browser and are not sent in tool analytics. A time budget alone does not show exam readiness.</p></div>
<details className="rounded-lg border border-border p-4"><summary className="cursor-pointer font-semibold text-foreground">How the time calculation works</summary><p className="mt-3 leading-7">Weights set relative time shares, not expected question counts. When approximate weights exceed 100%, time is divided by their sum. Incomplete weights produce an explicitly labelled even split. The final week is proportional, exam day is excluded, and time is rounded to whole minutes.</p></details></>}><StudyPlanner certs={toolCertifications()} /></ToolPage>;
}
