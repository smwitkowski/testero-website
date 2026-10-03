import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PhasePlaceholderProps {
  phase: 2 | 3 | 4;
  title: string;
  description: string;
  primary?: { href: string; label: string };
  links?: { href: string; label: string }[];
  children?: ReactNode;
}

export function PhasePlaceholder({ phase, title, description, primary, links = [], children }: PhasePlaceholderProps) {
  const action = primary ?? { href: "/diagnostic", label: "Start free diagnostic" };
  return (
    <section className="space-y-6">
      <span className="inline-block rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-primary">Coming in Phase {phase}</span>
      <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h1>
      <p className="max-w-xl leading-relaxed text-muted-foreground">{description}</p>
      {children}
      <div className="flex flex-wrap items-center gap-4">
        <Button asChild><Link href={action.href}>{action.label}</Link></Button>
        {links.map((link) => <Link key={link.href} href={link.href} className="py-2 text-sm font-medium text-primary hover:underline">{link.label}</Link>)}
      </div>
    </section>
  );
}
