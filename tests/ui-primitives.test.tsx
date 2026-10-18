import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

describe("shared design primitives", () => {
  it.each(["default", "featured", "subtle"] as const)("composes a %s card with a title and trailing action", variant => {
    const html = renderToStaticMarkup(<Card variant={variant}><CardHeader><CardTitle>Plan</CardTitle></CardHeader><CardContent>Details</CardContent><CardFooter><Button>Continue</Button></CardFooter></Card>);
    expect(html).toContain(`data-variant="${variant}"`);
    expect(html).toContain('<h2');
    expect(html.indexOf('Details')).toBeLessThan(html.indexOf('Continue'));
  });
});
