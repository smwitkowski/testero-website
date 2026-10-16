import { verifiedNavigationUserId } from "@/lib/auth/navigation";

export async function GET() {
  return Response.json({ userId: await verifiedNavigationUserId() }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
