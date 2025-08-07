import { PostHog } from "posthog-node";

// Server-side PostHog instance for API routes
let serverPostHog: PostHog | null = null;

export function getServerPostHog(): PostHog {
  if (!serverPostHog) {
    serverPostHog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY || "", {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
    });
  }
  return serverPostHog;
}

// Reset function for testing
export function resetServerPostHog() {
  serverPostHog = null;
}
