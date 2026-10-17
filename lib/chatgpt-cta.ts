export function chatgptPracticeUrl(enabled: string | undefined, configuredUrl: string | undefined): string | null {
  if (enabled !== "true" || !configuredUrl) return null;
  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.searchParams.set("utm_source", "chatgpt-cta");
    return url.toString();
  } catch {
    return null;
  }
}
