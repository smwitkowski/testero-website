import type { Metadata } from "next";
import { DiagnosticStart } from "@/components/diagnostic-start";

export const metadata: Metadata = { title: "Start your diagnostic" };
export default function DiagnosticStartPage() { return <DiagnosticStart />; }
