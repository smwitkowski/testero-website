import assert from "node:assert/strict";
import catalog from "../content/catalog.json" with { type: "json" };

const base = process.argv[2] ?? "http://127.0.0.1:3116";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Use a local built app");
const paths = ["/", "/blog", "/faq", "/pricing", ...catalog.blog.map(entry => entry.href), ...catalog.faq.map(entry => entry.href)];
for (const path of paths) {
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, 200, path);
  const cache = response.headers.get("cache-control");
  assert(cache && /s-maxage=300(?:,|$)/.test(cache) && !/private|no-store/.test(cache), `${path}: ${cache}`);
  assert(!response.headers.has("set-cookie"), path);
  const html = await response.text();
  const data = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
  const nodes = data.flatMap(item => item["@graph"] ?? [item]);
  assert(nodes.some(node => node["@type"] === "Organization"), path);
  assert(nodes.some(node => node["@type"] === "WebSite"), path);
  if (/^\/(blog|faq)\//.test(path)) {
    const article = nodes.find(node => node["@type"] === "BlogPosting");
    assert(article, path);
    for (const field of ["headline", "description", "datePublished", "dateModified", "author", "publisher", "mainEntityOfPage"]) assert(article[field], `${path}: ${field}`);
    assert.equal(article.author["@type"], "Organization");
    assert.equal(article.publisher["@type"], "Organization");
    assert(nodes.some(node => node["@type"] === "BreadcrumbList"), path);
  }
  assert(!nodes.some(node => node["@type"] === "FAQPage"), path);
  console.log(`${path}: ${cache}; ${nodes.length} valid JSON-LD nodes`);
}
