import assert from "node:assert/strict";

const base = process.argv[2] ?? "http://127.0.0.1:3116";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Use a local built app");
const cookie = { Cookie: "sb-local-auth-token.0=invalid-fixture" };
for (const path of ["/", "/blog", "/blog/5-hardest-pmle-questions", "/faq", "/faq/how-long-is-the-google-ml-engineer-exam", "/pricing", "/robots.txt", "/sitemap.xml"]) {
  for (const headers of [{}, cookie]) {
    const response = await fetch(`${base}${path}`, { headers, redirect: "manual" });
    const cache = response.headers.get("cache-control") ?? "";
    assert.equal(response.status, 200, path);
    if (["/robots.txt", "/sitemap.xml"].includes(path)) {
      assert.match(cache, /max-age=0, must-revalidate/, path);
    } else {
      assert.match(cache, /s-maxage=300(?:,|$)/, path);
      const stale = /stale-while-revalidate=(\d+)/.exec(cache);
      assert(stale && Number(stale[1]) <= 86400, path);
    }
    assert(!response.headers.has("set-cookie"), path);
    console.log(`${path}: ${cache}; no Set-Cookie`);
  }
}
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const privatePaths = ["/dashboard", "/account", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/confirm", "/diagnostic", `/diagnostic/${id}`, `/diagnostic/${id}/results`, `/practice/${id}`, `/practice/${id}/summary`, "/checkout/success", "/results/example", "/api/health", "/api/auth/navigation", "/api/billing/access", `/api/diagnostic/${id}`, `/api/diagnostic/${id}/results`, `/api/practice/${id}`, `/api/practice/${id}/summary`, "/api/billing/status"];
for (const path of privatePaths) {
  const response = await fetch(`${base}${path}`, { redirect: "manual", headers: cookie });
  const cache = response.headers.get("cache-control") ?? "";
  assert.match(cache, /private/, path);
  assert.match(cache, /no-store/, path);
  assert(!/s-maxage/.test(cache), path);
  console.log(`${path}: ${response.status}; ${cache}`);
}
for (const path of ["/api/auth/signup", "/api/auth/login", "/api/auth/logout", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/resend", "/api/diagnostic", `/api/diagnostic/${id}/answer`, "/api/practice", `/api/practice/${id}/answer`, "/api/billing/checkout", "/api/billing/portal", "/api/billing/webhook"]) {
  const response = await fetch(`${base}${path}`, { method: "POST", body: "{}", headers: { ...cookie, "Content-Type": "application/json" }, redirect: "manual" });
  const cache = response.headers.get("cache-control") ?? "";
  assert.match(cache, /private/, path);
  assert.match(cache, /no-store/, path);
  assert(!/s-maxage/.test(cache), path);
  console.log(`POST ${path}: ${response.status}; ${cache}`);
}
const html = await (await fetch(base)).text();
const asset = /(?:href|src)="([^" ]*\/_next\/static\/[^" ]+)"/.exec(html)?.[1];
assert(asset, "Expected a hashed static asset");
const staticResponse = await fetch(new URL(asset, base));
assert.match(staticResponse.headers.get("cache-control") ?? "", /max-age=31536000, immutable/);
assert(!staticResponse.headers.has("set-cookie"));
console.log("hashed /_next/static asset: immutable; no Set-Cookie");
