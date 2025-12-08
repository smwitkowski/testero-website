"use client";

import { useFormContext } from "react-hook-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DomainOption } from "@/lib/admin/questions/editor-types";

interface QuestionMetadataCardProps {
  domainOptions: DomainOption[];
  sourceRef?: string | null;
}

export function QuestionMetadataCard({
  domainOptions,
  sourceRef,
}: QuestionMetadataCardProps) {
  const form = useFormContext();
  const difficulty = form.watch("difficulty") || "MEDIUM";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metadata</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="domain_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Domain</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a domain" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {domainOptions.map((domain) => (
                    <SelectItem key={domain.id} value={domain.id}>
                      {domain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="difficulty"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Difficulty</FormLabel>
              <FormControl>
                <div className="inline-flex rounded-md border border-border bg-background p-1" role="group">
                  <Button
                    type="button"
                    variant={difficulty === "EASY" ? "solid" : "ghost"}
                    tone={difficulty === "EASY" ? "accent" : "neutral"}
                    size="sm"
                    className={cn(
                      "rounded-md",
                      difficulty !== "EASY" && "hover:bg-muted"
                    )}
                    onClick={() => {
                      field.onChange("EASY");
                      form.setValue("difficulty", "EASY", { shouldDirty: true });
                    }}
                  >
                    Easy
                  </Button>
                  <Button
                    type="button"
                    variant={difficulty === "MEDIUM" ? "solid" : "ghost"}
                    tone={difficulty === "MEDIUM" ? "accent" : "neutral"}
                    size="sm"
                    className={cn(
                      "rounded-md",
                      difficulty !== "MEDIUM" && "hover:bg-muted"
                    )}
                    onClick={() => {
                      field.onChange("MEDIUM");
                      form.setValue("difficulty", "MEDIUM", { shouldDirty: true });
                    }}
                  >
                    Medium
                  </Button>
                  <Button
                    type="button"
                    variant={difficulty === "HARD" ? "solid" : "ghost"}
                    tone={difficulty === "HARD" ? "accent" : "neutral"}
                    size="sm"
                    className={cn(
                      "rounded-md",
                      difficulty !== "HARD" && "hover:bg-muted"
                    )}
                    onClick={() => {
                      field.onChange("HARD");
                      form.setValue("difficulty", "HARD", { shouldDirty: true });
                    }}
                  >
                    Hard
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {sourceRef && (
          <FormItem>
            <FormLabel>Source</FormLabel>
            <Input value={sourceRef} disabled readOnly />
          </FormItem>
        )}
      </CardContent>
    </Card>
  );
}
