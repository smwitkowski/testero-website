import { getBlogEntries, getFaqEntries } from "@/lib/content/loader";
import { isComingSoon } from "@/lib/content/exam";

export function relatedPmleGuides(excludeHref?: string) {
  return [...getBlogEntries(), ...getFaqEntries()]
    .filter(entry => !isComingSoon(entry.exam) && entry.href !== excludeHref).slice(0, 4);
}
