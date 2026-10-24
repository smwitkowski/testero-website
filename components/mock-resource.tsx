"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
export class MockRequestError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function mockRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new MockRequestError(response.status, typeof body?.error === "string" ? body.error : "The mock exam could not be loaded.");
  return body as T;
}
export function useMockResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => { setData(null); setError(null); setVersion(value => value + 1); }, []);
  useEffect(() => {
    const controller = new AbortController();
    mockRequest<T>(path, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setData(value); }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error("The mock exam could not be loaded.")); });
    return () => controller.abort();
  }, [path, version]);
  useEffect(() => {
    const visibility = () => { if (document.visibilityState === "hidden") setData(null); else reload(); };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("focus", reload); document.removeEventListener("visibilitychange", visibility); };
  }, [reload]);
  return { data, setData, error, setError, reload };
}
export function MockError({ error, retry }: { error: Error; retry?: () => void }) {
  return <div className="mx-auto max-w-2xl space-y-5"><h1 className="text-2xl font-semibold">Mock exam unavailable</h1><p role="alert">{error.message}</p>
    {error instanceof MockRequestError && error.status === 403 && <Button asChild><Link href="/pricing">Explore PMLE Pass</Link></Button>}
    {error instanceof MockRequestError && error.status === 401 && <Button asChild><Link href="/login?next=%2Fmock">Sign in</Link></Button>}
    {retry && <Button variant="outline" onClick={retry}>Reload saved mock</Button>}<p><Link className="underline" href="/dashboard">Back to dashboard</Link></p></div>;
}
