"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ExitTestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export const ExitTestModal: React.FC<ExitTestModalProps> = ({
  open,
  onOpenChange,
  onConfirm,
}) => {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exit Test?</DialogTitle>
          <DialogDescription>
            Are you sure you want to exit? Your current attempt will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            tone="neutral"
            size="md"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="solid"
            tone="danger"
            size="md"
            onClick={handleConfirm}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

