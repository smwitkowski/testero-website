"use client";

import { useEffect, useState } from "react";

export async function diagnosticRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store", credentials: "same-origin" });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new Error("This diagnostic is not available in this browser. Return to the start to begin a new one.");
    }
    if (response.status === 409) throw new Error("This diagnostic has changed. Retry to load your saved progress.");
    if (response.status === 410) throw new Error("This diagnostic has expired. Return to the start to begin a new one.");
    throw new Error("We could not connect to your diagnostic. Check your connection and retry.");
  }
  return response.json() as Promise<T>;
}

export function requestError(error: unknown) {
  return error instanceof TypeError
    ? "We could not connect to your diagnostic. Check your connection and retry."
    : error instanceof Error ? error.message : "We could not load your diagnostic. Please retry.";
}

export function useDiagnosticResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    diagnosticRequest<T>(path, { signal: controller.signal }).then(
      (value) => { if (!controller.signal.aborted) setData(value); },
      (reason: unknown) => { if (!controller.signal.aborted) setError(requestError(reason)); },
    );
    return () => controller.abort();
  }, [path, attempt]);
  function reload() {
    setData(null);
    setError(null);
    setAttempt((value) => value + 1);
  }
  return { data, error, reload };
}
