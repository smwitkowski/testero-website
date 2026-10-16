"use client";
import { useEffect } from "react";
import { trackTool } from "@/lib/analytics/client";
export function TrackerEvents() {
  useEffect(() => { trackTool("tool_used", "exam-guide-changes"); trackTool("tool_result_viewed", "exam-guide-changes"); }, []);
  return null;
}
