export const dynamic = "force-dynamic";

export function GET() {
  const challenge = process.env.OPENAI_APPS_CHALLENGE;
  return new Response(challenge || null, {
    status: challenge ? 200 : 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
