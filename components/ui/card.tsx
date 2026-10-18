import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("flex flex-col rounded-lg border text-card-foreground", {
  variants: {
    variant: {
      default: "border-border bg-card shadow-sm",
      featured: "border-primary border-t-4 bg-card shadow-md",
      subtle: "border-border bg-muted",
    },
  },
  defaultVariants: { variant: "default" },
});

function Card({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return <div data-slot="card" data-variant={variant ?? "default"} className={cn(cardVariants({ variant }), className)} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("space-y-2 p-6 sm:p-8", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 data-slot="card-title" className={cn("text-xl font-semibold leading-tight", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-6 pb-6 sm:px-8 sm:pb-8", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("mt-auto flex items-center gap-3 px-6 pb-6 sm:px-8 sm:pb-8", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardContent, CardFooter, cardVariants };
