"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { mockRequest } from "@/components/mock-resource";
export function MockStart() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    setPending(true); setError(null);
    try {
      const result = await mockRequest<{ href: string }>("/api/mock/start", { method: "POST" });
      router.push(result.href);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The mock could not be started."); setPending(false); }
  }
  return <div className="space-y-3"><Button onClick={start} disabled={pending}>{pending ? "Preparing mock…" : "Start timed mock"}</Button>{error && <p role="alert">{error}</p>}</div>;
}
