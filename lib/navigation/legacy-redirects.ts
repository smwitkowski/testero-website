import manifest from "../../content/legacy-url-manifest.json";

export type LegacyRedirectRule = {
  source: string;
  destination: string;
  permanent: true;
  reason: string;
};

/** Frozen inventory from every sitemap-*.xml at the referenced PMLE commit. */
export const legacyPaths: readonly string[] = manifest.paths;

/** Next runs these 308 redirects before proxy/auth. Specific content rules precede fallback. */
export const redirectRules: readonly LegacyRedirectRule[] = [
  {"source": "/practice/question/:path*", "destination": "/dashboard", "permanent": true, "reason": "Single-question practice retired; start a domain session from dashboard."},
  {"source": "/practice/session/:path*", "destination": "/dashboard", "permanent": true, "reason": "Legacy sessions are not migrated."},
  {"source": "/dashboard/settings/:path*", "destination": "/account", "permanent": true, "reason": "Account and pass status now live together."},
  {"source": "/dashboard/billing", "destination": "/account", "permanent": true, "reason": "Billing now lives on account."},
  {"source": "/dashboard/performance", "destination": "/dashboard", "permanent": true, "reason": "Readiness now lives on dashboard."},
  {"source": "/blog/tags/:path*", "destination": "/blog", "permanent": true, "reason": "Browse the retained blog."},
  {"source": "/blog/categories/:path*", "destination": "/blog", "permanent": true, "reason": "Browse the retained blog."},
  {"source": "/admin/:path*", "destination": "/dashboard", "permanent": true, "reason": "Admin UI is not part of v2."},
  {"source": "/beta/:path*", "destination": "/diagnostic", "permanent": true, "reason": "Use the public diagnostic."},
  {"source": "/early-access-coming-soon", "destination": "/diagnostic", "permanent": true, "reason": "Use the public diagnostic."},
  {"source": "/waitlist", "destination": "/signup", "permanent": true, "reason": "Accounts replace the waitlist."},
  {"source": "/study-path", "destination": "/dashboard", "permanent": true, "reason": "Practice starts on dashboard."},
  {"source": "/verify-email", "destination": "/login", "permanent": true, "reason": "Sign in after verifying the email link."},
  {"source": "/diagnostic/:sessionId/summary", "destination": "/diagnostic", "permanent": true, "reason": "Legacy diagnostic sessions are not migrated."},
  {"source": "/content/hub/google-cloud-certification-guide", "destination": "/faq/what-is-google-cloud-certification", "permanent": true, "reason": "Closest retained article for the retired hub."},
  {"source": "/content/hub/google-cloud-certification-guide.md", "destination": "/faq/what-is-google-cloud-certification", "permanent": true, "reason": "Closest retained article for the retired hub."},
  {"source": "/content/hub/google-data-analytics-professional-certificate-2025-guide", "destination": "/faq/is-google-data-analytics-certification-worth-it", "permanent": true, "reason": "Closest retained article for the retired hub."},
  {"source": "/content/hub/google-data-analytics-professional-certificate-2025-guide.md", "destination": "/faq/is-google-data-analytics-certification-worth-it", "permanent": true, "reason": "Closest retained article for the retired hub."},
  {"source": "/content/hub/google-professional-machine-learning-engineer-certification-expansion-strategy", "destination": "/faq/is-the-google-professional-machine-learning-engineer-certification-worth-it", "permanent": true, "reason": "Closest retained article for the retired hub."},
  {"source": "/content/hub/google-professional-machine-learning-engineer-certification-expansion-strategy.md", "destination": "/faq/is-the-google-professional-machine-learning-engineer-certification-worth-it", "permanent": true, "reason": "Closest retained article for the retired hub."},
  {"source": "/content/hub/google-professional-machine-learning-engineer-certification-roadmap-2025", "destination": "/faq/is-the-google-professional-machine-learning-engineer-certification-worth-it", "permanent": true, "reason": "Closest retained article for the retired hub."},
  {"source": "/content/hub/google-professional-machine-learning-engineer-certification-roadmap-2025.md", "destination": "/faq/is-the-google-professional-machine-learning-engineer-certification-worth-it", "permanent": true, "reason": "Closest retained article for the retired hub."},
  {"source": "/content/hub/the-2025-google-cloud-digital-leader-certification-roadmap", "destination": "/blog/google-cloud-digital-leader-certification", "permanent": true, "reason": "Closest retained article for the retired hub."},
  {"source": "/content/hub/the-2025-google-cloud-digital-leader-certification-roadmap.md", "destination": "/blog/google-cloud-digital-leader-certification", "permanent": true, "reason": "Closest retained article for the retired hub."},
  {"source": "/content/blog/accelerated-google-ml-certification-30-day-success-story-2025", "destination": "/blog/accelerated-google-ml-certification-30-day-success-story-2025", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/blog/accelerated-google-ml-certification-30-day-success-story-2025.md", "destination": "/blog/accelerated-google-ml-certification-30-day-success-story-2025", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spoke/accelerated-google-ml-certification-30-day-success-story-2025", "destination": "/blog/accelerated-google-ml-certification-30-day-success-story-2025", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spoke/accelerated-google-ml-certification-30-day-success-story-2025.md", "destination": "/blog/accelerated-google-ml-certification-30-day-success-story-2025", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spokes/accelerated-google-ml-certification-30-day-success-story-2025", "destination": "/blog/accelerated-google-ml-certification-30-day-success-story-2025", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spokes/accelerated-google-ml-certification-30-day-success-story-2025.md", "destination": "/blog/accelerated-google-ml-certification-30-day-success-story-2025", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/blog/pmle-october-2024-exam-changes", "destination": "/blog/pmle-october-2024-exam-changes", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/blog/pmle-october-2024-exam-changes.md", "destination": "/blog/pmle-october-2024-exam-changes", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spoke/pmle-october-2024-exam-changes", "destination": "/blog/pmle-october-2024-exam-changes", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spoke/pmle-october-2024-exam-changes.md", "destination": "/blog/pmle-october-2024-exam-changes", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spokes/pmle-october-2024-exam-changes", "destination": "/blog/pmle-october-2024-exam-changes", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spokes/pmle-october-2024-exam-changes.md", "destination": "/blog/pmle-october-2024-exam-changes", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/blog/5-hardest-pmle-questions", "destination": "/blog/5-hardest-pmle-questions", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/blog/5-hardest-pmle-questions.md", "destination": "/blog/5-hardest-pmle-questions", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spoke/5-hardest-pmle-questions", "destination": "/blog/5-hardest-pmle-questions", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spoke/5-hardest-pmle-questions.md", "destination": "/blog/5-hardest-pmle-questions", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spokes/5-hardest-pmle-questions", "destination": "/blog/5-hardest-pmle-questions", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spokes/5-hardest-pmle-questions.md", "destination": "/blog/5-hardest-pmle-questions", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/blog/google-cloud-digital-leader-certification", "destination": "/blog/google-cloud-digital-leader-certification", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/blog/google-cloud-digital-leader-certification.md", "destination": "/blog/google-cloud-digital-leader-certification", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spoke/google-cloud-digital-leader-certification", "destination": "/blog/google-cloud-digital-leader-certification", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spoke/google-cloud-digital-leader-certification.md", "destination": "/blog/google-cloud-digital-leader-certification", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spokes/google-cloud-digital-leader-certification", "destination": "/blog/google-cloud-digital-leader-certification", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spokes/google-cloud-digital-leader-certification.md", "destination": "/blog/google-cloud-digital-leader-certification", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/blog/pmle-vs-aws-ml-vs-azure-ai", "destination": "/blog/pmle-vs-aws-ml-vs-azure-ai", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/blog/pmle-vs-aws-ml-vs-azure-ai.md", "destination": "/blog/pmle-vs-aws-ml-vs-azure-ai", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spoke/pmle-vs-aws-ml-vs-azure-ai", "destination": "/blog/pmle-vs-aws-ml-vs-azure-ai", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spoke/pmle-vs-aws-ml-vs-azure-ai.md", "destination": "/blog/pmle-vs-aws-ml-vs-azure-ai", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spokes/pmle-vs-aws-ml-vs-azure-ai", "destination": "/blog/pmle-vs-aws-ml-vs-azure-ai", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/spokes/pmle-vs-aws-ml-vs-azure-ai.md", "destination": "/blog/pmle-vs-aws-ml-vs-azure-ai", "permanent": true, "reason": "Keep legacy article links on the current blog URL."},
  {"source": "/content/briefs/google-ml-engineer-cert-worth-it", "destination": "/faq/is-the-google-professional-machine-learning-engineer-certification-worth-it", "permanent": true, "reason": "Closest retained article for the retired brief."},
  {"source": "/content/briefs/google-ml-engineer-cert-worth-it.md", "destination": "/faq/is-the-google-professional-machine-learning-engineer-certification-worth-it", "permanent": true, "reason": "Closest retained article for the retired brief."},
  {"source": "/content/briefs/google-ml-engineer-cert-worth-it_formatted", "destination": "/faq/is-the-google-professional-machine-learning-engineer-certification-worth-it", "permanent": true, "reason": "Closest retained article for the retired brief."},
  {"source": "/content/briefs/google-ml-engineer-cert-worth-it_formatted.md", "destination": "/faq/is-the-google-professional-machine-learning-engineer-certification-worth-it", "permanent": true, "reason": "Closest retained article for the retired brief."},
  {"source": "/content/briefs/accelerated-ml-cert-success", "destination": "/blog/accelerated-google-ml-certification-30-day-success-story-2025", "permanent": true, "reason": "Closest retained article for the retired brief."},
  {"source": "/content/briefs/accelerated-ml-cert-success.md", "destination": "/blog/accelerated-google-ml-certification-30-day-success-story-2025", "permanent": true, "reason": "Closest retained article for the retired brief."},
  {"source": "/content/briefs/gcp-vs-aws-ml-cert-comparison", "destination": "/blog/pmle-vs-aws-ml-vs-azure-ai", "permanent": true, "reason": "Closest retained article for the retired brief."},
  {"source": "/content/briefs/gcp-vs-aws-ml-cert-comparison.md", "destination": "/blog/pmle-vs-aws-ml-vs-azure-ai", "permanent": true, "reason": "Closest retained article for the retired brief."},
  {"source": "/content/briefs/gcp-vs-azure-ml-cert-comparison", "destination": "/blog/pmle-vs-aws-ml-vs-azure-ai", "permanent": true, "reason": "Closest retained article for the retired brief."},
  {"source": "/content/briefs/gcp-vs-azure-ml-cert-comparison.md", "destination": "/blog/pmle-vs-aws-ml-vs-azure-ai", "permanent": true, "reason": "Closest retained article for the retired brief."},
  {"source": "/content/:path*", "destination": "/faq", "permanent": true, "reason": "Content hub retired; find certification answers in FAQ."},
];

/** Export only the fields accepted by Next's redirects configuration. */
export function nextLegacyRedirects() {
  return redirectRules.map(({ source, destination, permanent }) => ({ source, destination, permanent }));
}

/** Resolve a URL-audit pathname with the same source patterns used by Next. */
export function getLegacyRedirect(path: string): LegacyRedirectRule | undefined {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\?#]/.test(path)) return undefined;
  let decoded: string;
  try { decoded = decodeURIComponent(path); } catch { return undefined; }
  if (decoded.startsWith("//") || /[\\?#]/.test(decoded) || decoded.split("/").some(part => part === "." || part === "..")) return undefined;
  const normalized = decoded === "/" ? decoded : decoded.replace(/\/+$/, "");
  return redirectRules.find(rule => {
    const sourceParts = rule.source.split("/").slice(1);
    const pathParts = normalized.split("/").slice(1);
    return sourceParts.every((part, index) => {
      if (part.endsWith("*")) return true;
      if (part.startsWith(":")) return !!pathParts[index];
      return part === pathParts[index];
    }) && (sourceParts.at(-1)?.endsWith("*") || sourceParts.length === pathParts.length);
  });
}

export function resolveLegacyPath(path: string): { path: string; status: 200 | 308 } {
  const rule = getLegacyRedirect(path);
  return rule ? { path: rule.destination, status: 308 } : { path, status: 200 };
}
