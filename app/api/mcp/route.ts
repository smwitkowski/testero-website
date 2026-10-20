import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createChatgptServer } from "@/lib/chatgpt/tools";
import { allowMcpRequest } from "@/lib/chatgpt/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Server-to-server MCP calls normally omit Origin.
  const allowed = ["https://chatgpt.com", "https://chat.openai.com", "https://testero.ai"];
  if (process.env.NODE_ENV !== "production") allowed.push("http://127.0.0.1:3000", "http://localhost:3000");
  return allowed.includes(origin);
}
function decorate(response: Response, request: Request) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Vary", "Origin");
  const origin = request.headers.get("origin");
  if (origin && validOrigin(request)) response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, MCP-Protocol-Version, Mcp-Session-Id");
  response.headers.set("Access-Control-Expose-Headers", "Retry-After");
  return response;
}
function guard(request: Request) {
  if (!validOrigin(request)) return new Response(null, { status: 403 });
  if (!allowMcpRequest(request)) return decorate(new Response(null, { status: 429, headers: { "Retry-After": "60" } }), request);
}
export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  const server = createChatgptServer(request);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 16_384 });
  try {
    await server.connect(transport);
    return decorate(await transport.handleRequest(request), request);
  } finally {
    await server.close();
  }
}
// This stateless, request/response service has no standalone SSE stream or session to delete.
function unsupported(request: Request) {
  return guard(request) ?? decorate(new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS" } }), request);
}
export const GET = unsupported;
export const DELETE = unsupported;
export function OPTIONS(request: Request) {
  return guard(request) ?? decorate(new Response(null, { status: 204 }), request);
}
