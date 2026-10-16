import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import catalog from "../content/catalog.json" with { type: "json" };

import registry from "../content-pipeline/certs/registry.json" with { type: "json" };

const base = process.argv[2] ?? "http://127.0.0.1:3116";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Use a local built app");
const paths = ["/", "/blog", "/faq", "/pricing", "/certifications", ...registry.certifications.map(cert => `/certifications/${cert.cert_id}`), ...catalog.blog.map(entry => entry.href), ...catalog.faq.map(entry => entry.href)];
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
  if (path.startsWith("/certifications")) {
    const crumbs = nodes.find(node => node["@type"] === "BreadcrumbList");
    assert(crumbs, path);
    assert.equal(crumbs.itemListElement.length, path === "/certifications" ? 2 : 3);
    if (path !== "/certifications") {
      const cert = registry.certifications.find(cert => path.endsWith(`/${cert.cert_id}`));
      const credential = nodes.find(node => node["@type"] === "EducationalOccupationalCredential");
      assert.equal(credential?.name, cert.name, path);
      assert.equal(credential?.url, JSON.parse(readFileSync(`content-pipeline/certs/${cert.file}`, "utf8")).cert_url, path);
      assert.equal(credential?.recognizedBy?.name, "Google", path);
    }
  }
  assert(!nodes.some(node => node["@type"] === "FAQPage"), path);
  console.log(`${path}: ${cache}; ${nodes.length} valid JSON-LD nodes`);
}
