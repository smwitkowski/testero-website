"use client";

import { useFormContext, useWatch } from "react-hook-form";
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
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { QuestionAnswer } from "@/lib/admin/questions/editor-types";

export function AnswerOptionsCard() {
  const form = useFormContext();
  const answers = useWatch({ control: form.control, name: "answers" }) || [];

  const correctAnswerIndex = answers.findIndex((a: { is_correct: boolean }) => a.is_correct);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Answer options</CardTitle>
        <FormDescription>
          Provide 4 options (A–D). Mark exactly one as correct. Add explanations for each option explaining why it&apos;s correct or incorrect.
        </FormDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="answers"
          render={() => (
            <FormItem>
              <FormControl>
                <RadioGroup
                  value={correctAnswerIndex >= 0 ? String(correctAnswerIndex) : undefined}
                  onValueChange={(value) => {
                    const index = Number.parseInt(value, 10);
                    const currentAnswers = form.getValues("answers") || [];
                    const updatedAnswers = currentAnswers.map((answer: QuestionAnswer, i: number) => ({
                      ...answer,
                      is_correct: i === index,
                    }));
                    form.setValue("answers", updatedAnswers, { shouldValidate: true, shouldDirty: true });
                  }}
                >
                  {["A", "B", "C", "D"].map((label, index) => (
                    <FormField
                      key={label}
                      control={form.control}
                      name={`answers.${index}`}
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3 min-w-0">
                            <div className="flex items-center gap-2 pt-1 flex-shrink-0">
                              <RadioGroupItem
                                value={String(index)}
                                id={`answer-${index}`}
                              />
                              <Label
                                htmlFor={`answer-${index}`}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground"
                              >
                                {label}
                              </Label>
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <FormControl>
                                <Textarea
                                  value={field.value?.choice_text || ""}
                                  onChange={(e) => {
                                    const currentAnswers = form.getValues("answers") || [];
                                    const updatedAnswers = [...currentAnswers];
                                    updatedAnswers[index] = {
                                      ...updatedAnswers[index],
                                      choice_label: label as "A" | "B" | "C" | "D",
                                      choice_text: e.target.value,
                                      is_correct: updatedAnswers[index]?.is_correct || false,
                                      explanation_text: updatedAnswers[index]?.explanation_text || "",
                                    };
                                    form.setValue("answers", updatedAnswers, { shouldValidate: true, shouldDirty: true });
                                  }}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  placeholder={`Option ${label}`}
                                  rows={2}
                                  className="text-sm break-words resize-none"
                                />
                              </FormControl>
                              {field.value?.is_correct && (
                                <Badge tone="success" variant="soft" size="sm">
                                  Correct answer
                                </Badge>
                              )}
                              <FormControl>
                                <Textarea
                                  value={field.value?.explanation_text || ""}
                                  onChange={(e) => {
                                    const currentAnswers = form.getValues("answers") || [];
                                    const updatedAnswers = [...currentAnswers];
                                    updatedAnswers[index] = {
                                      ...updatedAnswers[index],
                                      choice_label: label as "A" | "B" | "C" | "D",
                                      choice_text: updatedAnswers[index]?.choice_text || "",
                                      is_correct: updatedAnswers[index]?.is_correct || false,
                                      explanation_text: e.target.value,
                                    };
                                    form.setValue("answers", updatedAnswers, { shouldValidate: true, shouldDirty: true });
                                  }}
                                  placeholder={
                                    field.value?.is_correct
                                      ? "Explain why this is the correct answer..."
                                      : "Explain why this option is incorrect..."
                                  }
                                  rows={3}
                                  className="text-sm break-words"
                                />
                              </FormControl>
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
              {form.formState.errors.answers && (
                <p className="text-sm text-destructive">
                  {(form.formState.errors.answers.root?.message || form.formState.errors.answers.message) as string}
                </p>
              )}
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
