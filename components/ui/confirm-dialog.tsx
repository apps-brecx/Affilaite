"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Are you sure?" confirmation dialog. Drive it with a piece of state that
 * holds the pending action (or null when closed); call `onConfirm` when the
 * user commits and `onClose` to dismiss.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger" | "success";
  pending?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} className="max-w-md">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={pending}
          className={cn(
            variant === "danger" && "bg-danger text-danger-foreground hover:bg-danger/90",
            variant === "success" && "bg-success text-success-foreground hover:bg-success/90",
          )}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
