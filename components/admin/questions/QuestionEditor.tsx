"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { QuestionUpdateSchema, type QuestionUpdateInput } from "@/lib/admin/questions/editor-schema";
import type { QuestionEditorData, DomainOption } from "@/lib/admin/questions/editor-types";
import type { ReviewQueueMetadata } from "@/lib/admin/questions/editor-query";
import { Form } from "@/components/ui/form";
import { QuestionMetadataCard } from "./QuestionMetadataCard";
import { DecisionMatrixCard } from "./DecisionMatrixCard";
import { ReviewNotesCard } from "./ReviewWorkflowCard";
import { AnswerOptionsCard } from "./AnswerOptionsCard";
import { QuestionStemCard } from "./QuestionStemCard";
import { GeneralExplanationCard } from "./GeneralExplanationCard";
import { RenderedQuestionStem } from "./RenderedQuestionStem";
import { RenderedAnswerOptions } from "./RenderedAnswerOptions";
import { RenderedExplanation } from "./RenderedExplanation";
import { EditorHeader } from "./EditorHeader";
import { Toast, useToastQueue } from "@/components/ui/toast";

interface QuestionEditorProps {
  question: QuestionEditorData;
  domainOptions: DomainOption[];
  previousQuestionId?: string | null;
  nextQuestionId?: string | null;
  queueMetadata?: ReviewQueueMetadata;
  onSave?: (data: QuestionUpdateInput) => Promise<void>;
}

export function QuestionEditor({
  question,
  domainOptions,
  previousQuestionId,
  nextQuestionId,
  queueMetadata,
  onSave,
}: QuestionEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<"review" | "edit">("review");
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
      explanation_text: question.explanation?.explanation_text || "",
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
      doc_links: question.explanation?.doc_links || [],
    },
  });

  const hasUnsavedChanges = form.formState.isDirty;

  const handleSave = async (): Promise<boolean> => {
    const isValid = await form.trigger();
    if (!isValid) {
      addToast({
        title: "Validation failed",
        description: "Please fix the errors before saving.",
        tone: "danger",
      });
      return false;
    }

    const data = form.getValues();
    return new Promise((resolve) => {
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
          resolve(true);
        } catch (error) {
          console.error("Save error:", error);
          addToast({
            title: "Save failed",
            description: error instanceof Error ? error.message : "Failed to save question. Please try again.",
            tone: "danger",
          });
          resolve(false);
        }
      });
    });
  };

  const handleMarkGoodAndNext = async () => {
    form.setValue("review_status", "GOOD");
    form.setValue("status", "ACTIVE");
    const success = await handleSave();
    if (success) {
      // Use queue next ID if available, otherwise fall back to regular next
      const targetId = queueMetadata?.nextId || nextQuestionId;
      if (targetId) {
        router.push(`/admin/questions/${targetId}`);
      }
    }
  };

  const handleMarkBadAndNext = async () => {
    form.setValue("review_status", "RETIRED");
    form.setValue("status", "RETIRED");
    const success = await handleSave();
    if (success) {
      // Use queue next ID if available, otherwise fall back to regular next
      const targetId = queueMetadata?.nextId || nextQuestionId;
      if (targetId) {
        router.push(`/admin/questions/${targetId}`);
      }
    }
  };

  const handleSaveAndNext = async () => {
    const success = await handleSave();
    if (success) {
      // Use queue next ID if available, otherwise fall back to regular next
      const targetId = queueMetadata?.nextId || nextQuestionId;
      if (targetId) {
        router.push(`/admin/questions/${targetId}`);
      }
    }
  };

  return (
    <Form {...form}>
      <div className="flex min-h-screen flex-col -mx-4 lg:-mx-8">
        <EditorHeader
          questionId={question.id}
          questionStem={question.stem}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        <div className="flex-1 px-4 py-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
              <main className="space-y-6">
                {viewMode === "review" ? (
                  <>
                    <RenderedQuestionStem stem={question.stem} questionId={question.id} />
                    <RenderedAnswerOptions />
                    <RenderedExplanation />
                  </>
                ) : (
                  <>
                    <QuestionStemCard questionId={question.id} />
                    <AnswerOptionsCard />
                    <GeneralExplanationCard />
                  </>
                )}
              </main>

              <aside className="space-y-6 lg:sticky lg:top-[calc(var(--topbar-height,56px)+1px)] lg:self-start lg:max-h-[calc(100vh-var(--topbar-height,56px)-1px)] lg:overflow-y-auto">
                <QuestionMetadataCard
                  domainOptions={domainOptions}
                  sourceRef={question.source_ref}
                />
                <DecisionMatrixCard
                  previousQuestionId={queueMetadata?.previousId || previousQuestionId}
                  nextQuestionId={queueMetadata?.nextId || nextQuestionId}
                  queueMetadata={queueMetadata}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  onMarkGoodAndNext={handleMarkGoodAndNext}
                  onMarkBadAndNext={handleMarkBadAndNext}
                  onSaveAndNext={handleSaveAndNext}
                  isSaving={isPending}
                />
                <ReviewNotesCard />
              </aside>
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
