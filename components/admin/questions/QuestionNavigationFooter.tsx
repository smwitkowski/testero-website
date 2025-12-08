"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface QuestionNavigationFooterProps {
  previousQuestionId?: string | null;
  nextQuestionId?: string | null;
  onSaveAndNext?: () => Promise<void>;
  isSaving?: boolean;
}

export function QuestionNavigationFooter({
  previousQuestionId,
  nextQuestionId,
  onSaveAndNext,
  isSaving = false,
}: QuestionNavigationFooterProps) {
  const router = useRouter();

  const handlePrevious = () => {
    if (previousQuestionId) {
      router.push(`/admin/questions/${previousQuestionId}`);
    }
  };

  const handleNext = () => {
    if (nextQuestionId) {
      router.push(`/admin/questions/${nextQuestionId}`);
    }
  };

  const handleSaveAndNext = async () => {
    if (onSaveAndNext) {
      await onSaveAndNext();
    }
    if (nextQuestionId) {
      router.push(`/admin/questions/${nextQuestionId}`);
    }
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-muted/95 backdrop-blur-sm">
      <div className="mx-auto px-4 py-3 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={!previousQuestionId}
            icon={<ChevronLeft className="h-4 w-4" />}
          >
            Previous Question
          </Button>

          <Button
            type="button"
            onClick={handleSaveAndNext}
            disabled={!nextQuestionId || isSaving}
            loading={isSaving}
          >
            Save & Next
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleNext}
            disabled={!nextQuestionId}
            iconRight={<ChevronRight className="h-4 w-4" />}
          >
            Next Question
          </Button>
        </div>
      </div>
    </footer>
  );
}
