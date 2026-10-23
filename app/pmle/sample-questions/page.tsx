import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PublicSampleQuestion } from "@/components/public-sample-question";
import { StructuredData } from "@/components/structured-data";
import { getPublicSamples } from "@/lib/public-samples/loader";
import { canonicalUrl, pageMetadata } from "@/lib/seo";
import { PMLE_EXAM_GUIDE_URL } from "@/lib/constants/pmle-guide";

export function generateMetadata() {
  return pageMetadata("Free PMLE sample questions and explanations", getPublicSamples().length ? "Explore scenario-based PMLE sample questions with per-option explanations and official documentation, then try the free diagnostic." : "Public PMLE samples are being prepared. Explore the exam scope and choose a free 5-, 10- or 20-question diagnostic.", "/pmle/sample-questions");
}

export default function SampleQuestionsPage() {
  const questions = getPublicSamples();
  return <article className="space-y-8">
    {questions.length > 0 && <StructuredData value={{ "@context": "https://schema.org", "@type": "LearningResource", name: "PMLE sample questions and explanations", url: canonicalUrl("/pmle/sample-questions"), learningResourceType: "Practice questions", educationalUse: "Self-assessment", isAccessibleForFree: true, inLanguage: "en", about: "Google Cloud Professional Machine Learning Engineer certification" }} />}
    <header className="space-y-4"><Link href="/certifications/machine-learning-engineer" className="text-primary underline">PMLE exam guide</Link><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">PMLE sample questions</h1><p className="text-lg leading-7 text-body">Practice making decisions in Google Cloud ML scenarios. No account is needed for these public samples or the diagnostic.</p></header>
    <section className="space-y-4"><h2 className="text-2xl font-semibold">What does the PMLE test?</h2><p className="leading-7 text-body">The Professional Machine Learning Engineer exam covers low-code AI, data and model collaboration, scaling prototypes, serving models, ML pipelines and monitoring AI solutions. Use the <a href={PMLE_EXAM_GUIDE_URL} className="text-primary underline">official exam guide</a> to check the full scope.</p>
    <h2 className="text-2xl font-semibold">How are these sample questions written?</h2><p className="leading-7 text-body">Our public sample format uses original, scenario-based questions with four options. Each published question must be checked against Google documentation and explain every option, not just the correct answer. These are not Google exam questions. They are separate from Testero&apos;s diagnostic and practice bank.</p></section>
    {questions.length ? <div className="space-y-8">{questions.map((question, index) => <PublicSampleQuestion key={question.id} question={question} index={index} />)}</div> : <aside className="space-y-3 rounded-lg border border-border bg-card p-6"><h2 className="text-xl font-semibold">Samples are being prepared</h2><p className="leading-7 text-body">The ten public samples are not published yet. You can take the available diagnostic now for a readiness score and domain breakdown.</p></aside>}
    <section className="space-y-4 border-t border-border pt-6"><h2 className="text-2xl font-semibold">Want to check your readiness?</h2><Button asChild className="w-full whitespace-normal sm:w-auto"><Link href="/diagnostic?length=20">Take the free 20-question diagnostic</Link></Button><p className="text-sm text-muted-foreground">A readiness score is a study signal, not an exam-outcome guarantee.</p></section>
  </article>;
}
