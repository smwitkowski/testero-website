"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export class PracticeRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function practiceRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store", credentials: "same-origin" });
  if (!response.ok) {
    const message = response.status === 401 ? "Please sign in again to continue your practice."
      : response.status === 403 || response.status === 404 ? "This practice session is not available."
      : response.status === 409 ? "Your practice has changed. Reload your saved progress to continue."
      : response.status === 410 ? "This practice session has expired. Return to your dashboard."
      : response.status === 429 ? "You have used your 5 free practice questions for this week."
      : "Practice could not be loaded. Check your connection and retry.";
    throw new PracticeRequestError(response.status, message);
  }
  return response.json() as Promise<T>;
}

export function practiceError(reason: unknown): PracticeRequestError {
  return reason instanceof PracticeRequestError ? reason : new PracticeRequestError(0, "Practice could not be loaded. Check your connection and retry.");
}

export function usePracticeResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<PracticeRequestError | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    practiceRequest<T>(path, { signal: controller.signal }).then(
      value => { if (!controller.signal.aborted) setData(value); },
      reason => { if (!controller.signal.aborted) setError(practiceError(reason)); },
    );
    return () => controller.abort();
  }, [path, attempt]);
  function reload() { setData(null); setError(null); setAttempt(value => value + 1); }
  return { data, error, reload };
}

export function PracticeLoading({ message }: { message: string }) {
  return <p role="status" className="py-12 text-muted-foreground">{message}</p>;
}

export function PracticeError({ error, nextPath, onRetry }: { error: PracticeRequestError; nextPath: string; onRetry: () => void }) {
  return <section className="space-y-5">
    <h1 className="text-2xl font-semibold">Practice unavailable</h1>
    <p role="alert" className="leading-relaxed text-destructive">{error.message}</p>
    <div className="flex flex-wrap gap-3">
      {error.status === 401 ? <Button asChild><Link href={`/login?next=${encodeURIComponent(nextPath)}`}>Sign in</Link></Button> : <Button onClick={onRetry}>Retry</Button>}
      <Button variant="outline" asChild><Link href="/dashboard">Back to dashboard</Link></Button>
    </div>
  </section>;
}
