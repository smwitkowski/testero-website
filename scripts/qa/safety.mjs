import { execFile } from "node:child_process";
import { promisify } from "node:util";
export function localURL(value) {
  const u = new URL(value);
  if (u.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) || u.port !== "56541" || u.pathname !== "/" || u.username || u.password || u.search || u.hash) throw new Error("Expected isolated loopback Supabase API on port 56541");
  return u.origin;
}
export async function localStatus() {
  const { stdout } = await promisify(execFile)("supabase", ["status", "-o", "json"]);
  const status = JSON.parse(stdout);
  localURL(status.API_URL);
  if (!status.SERVICE_ROLE_KEY) throw new Error("Local service role unavailable");
  return status;
}
export async function rest(origin, key, table, query = "", rows) {
  if (!["exam_domains", "questions", "answers", "explanations"].includes(table)) throw new Error("Content table not allowed");
  if (rows) localURL(origin);
  const response = await fetch(`${origin}/rest/v1/${table}?${query}`, { method: rows ? "POST" : "GET", redirect: "error", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, ...(rows ? { body: JSON.stringify(rows) } : {}) });
  if (!response.ok) throw new Error(`Content request failed (${response.status}, ${table})`);
  return rows ? undefined : response.json();
}
export async function pages(origin, key, table, query) {
  const rows = [];
  for (let offset = 0;; offset += 500) {
    const batch = await rest(origin, key, table, `${query}&order=id&limit=500&offset=${offset}`);
    if (!Array.isArray(batch)) throw new Error("Invalid content response");
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
