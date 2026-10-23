import Link from "next/link";
import { Button } from "@/components/ui/button";

export function DiagnosticLoading({ message }: { message: string }) {
  return <p role="status" className="py-12 text-muted-foreground">{message}</p>;
}

export function DiagnosticError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Diagnostic unavailable</h1>
      <p role="alert" className="leading-relaxed text-destructive">{message}</p>
      <div className="flex flex-wrap gap-3">
        {onRetry && <Button onClick={onRetry}>Retry</Button>}
        <Button variant={onRetry ? "outline" : "default"} asChild><Link href="/diagnostic">{onRetry ? "Back to diagnostic start" : "Take a new diagnostic"}</Link></Button>
      </div>
    </section>
  );
}
