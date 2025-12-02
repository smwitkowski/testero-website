"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { QuestionUpdateSchema, type QuestionUpdateInput } from "@/lib/admin/questions/editor-schema";
import type { QuestionEditorData, DomainOption } from "@/lib/admin/questions/editor-types";
import { Form } from "@/components/ui/form";
import { QuestionMetadataCard } from "./QuestionMetadataCard";
import { ReviewWorkflowCard } from "./ReviewWorkflowCard";
import { AnswerOptionsCard } from "./AnswerOptionsCard";
import { EditorHeader } from "./EditorHeader";
import { Toast, useToastQueue } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuestionEditorProps {
  question: QuestionEditorData;
  domainOptions: DomainOption[];
  onSave?: (data: QuestionUpdateInput) => Promise<void>;
}

export function QuestionEditor({
  question,
  domainOptions,
  onSave,
}: QuestionEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { toasts, addToast, dismissToast } = useToastQueue();

  const form = useForm<QuestionUpdateInput>({
    resolver: zodResolver(QuestionUpdateSchema),
    defaultValues: {
      domain_id: question.domain_id,
      difficulty: question.difficulty || "MEDIUM",
      status: question.status || "DRAFT",
      review_status: question.review_status,
      review_notes: question.review_notes,
      stem: question.stem,
      answers: question.answers.length === 4
        ? question.answers.map((a) => ({
            ...a,
            explanation_text: a.explanation_text || "",
          }))
        : [
            { choice_label: "A", choice_text: "", is_correct: false, explanation_text: "" },
            { choice_label: "B", choice_text: "", is_correct: false, explanation_text: "" },
            { choice_label: "C", choice_text: "", is_correct: false, explanation_text: "" },
            { choice_label: "D", choice_text: "", is_correct: false, explanation_text: "" },
          ],
      doc_links: [],
    },
  });

  const hasUnsavedChanges = form.formState.isDirty;

  const handleSave = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      addToast({
        title: "Validation failed",
        description: "Please fix the errors before saving.",
        tone: "danger",
      });
      return;
    }

    const data = form.getValues();
    startTransition(async () => {
      try {
        if (onSave) {
          await onSave(data);
        } else {
          const response = await fetch(`/api/admin/questions/${question.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || "Failed to save question");
          }

          form.reset(data);
          addToast({
            title: "Question saved",
            description: "Your changes have been saved successfully.",
            tone: "success",
          });
          router.refresh();
        }
      } catch (error) {
        console.error("Save error:", error);
        addToast({
          title: "Save failed",
          description: error instanceof Error ? error.message : "Failed to save question. Please try again.",
          tone: "danger",
        });
      }
    });
  };

  const handleSaveAndMarkGood = async () => {
    form.setValue("review_status", "GOOD");
    form.setValue("status", "ACTIVE");
    await handleSave();
  };

  const handleMarkRetired = () => {
    form.setValue("review_status", "RETIRED");
    form.setValue("status", "RETIRED");
  };

  return (
    <Form {...form}>
      <div className="flex min-h-screen flex-col">
        <EditorHeader
          questionId={question.id}
          questionStem={question.stem}
          onSave={handleSave}
          onSaveAndMarkGood={handleSaveAndMarkGood}
          isSaving={isPending}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        <div className="flex-1 p-6">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
              <aside className="space-y-6">
                <QuestionMetadataCard
                  exam={question.exam}
                  domainOptions={domainOptions}
                  sourceRef={question.source_ref}
                />
                <ReviewWorkflowCard
                  onMarkGoodAndActive={handleSaveAndMarkGood}
                  onMarkRetired={handleMarkRetired}
                />
              </aside>

              <main className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Question</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="stem"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Question stem</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Write a clear, scenario-based question stem. Avoid trivia; focus on PMLE-style decisions."
                              rows={6}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <AnswerOptionsCard />
              </main>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 flex flex-col gap-3">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={() => toast.id && dismissToast(toast.id)}
          />
        ))}
      </div>
    </Form>
  );
}
