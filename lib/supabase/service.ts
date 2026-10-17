import "server-only";
import { createClient } from "@supabase/supabase-js";

let measuredRtt = false;

/** Never import into a Client Component. RLS bypass is paired with server ownership checks. */
export function createServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service configuration is missing");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const start = performance.now();
      try { return await fetch(input, init); }
      finally {
        if (process.env.NODE_ENV === "development") {
          // No query strings, owner IDs, request bodies, or credentials in timing logs.
          const path = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).pathname;
          console.info(`[supabase-timing] ${init?.method ?? "GET"} ${path} ${Math.round(performance.now() - start)}ms`);
        }
      }
    } },
  });
  if (process.env.NODE_ENV === "development" && !measuredRtt) {
    measuredRtt = true;
    const started = performance.now();
    void client.from("exam_domains").select("id").limit(1).then(({ error }) => {
      console.info(`[supabase-rtt] trivial query ${Math.round(performance.now() - started)}ms (${error ? "failed" : "ok"})`);
    });
  }
  return client;
}
