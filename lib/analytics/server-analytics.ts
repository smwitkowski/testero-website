import { PostHog } from "posthog-node";

// Server-side PostHog instance for API routes
let serverPostHog: PostHog | null | undefined;

export function getServerPostHog(): PostHog | null {
  if (typeof serverPostHog === "undefined") {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

    serverPostHog = apiKey
      ? new PostHog(apiKey, {
          host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
        })
      : null;
  }

  return serverPostHog ?? null;
}

// Reset function for testing
export function resetServerPostHog() {
  serverPostHog = undefined;
}
