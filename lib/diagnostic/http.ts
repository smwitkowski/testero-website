import "server-only";
import { NextResponse } from "next/server";
export class DiagnosticError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export function diagnosticErrorResponse(error: unknown) {
  const headers = { "Cache-Control": "private, no-store" };
  if (error instanceof DiagnosticError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
  console.error("Diagnostic request failed", error instanceof Error ? error.message : "Unknown failure");
  return NextResponse.json({ error: "The diagnostic is unavailable. Please try again." }, { status: 500, headers });
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  // Next's internal request URL may use localhost even when the browser uses 127.0.0.1.
  // Host comes from the HTTP request. Browser scripts cannot set it.
  const expected = new URL(request.url);
  const host = request.headers.get("host");
  if (host) {
    expected.port = "";
    expected.host = host;
  }
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  if (forwardedProtocol === "https" || forwardedProtocol === "http") expected.protocol = `${forwardedProtocol}:`;
  if (origin !== expected.origin) throw new DiagnosticError(403, "Request origin is not allowed");
}
