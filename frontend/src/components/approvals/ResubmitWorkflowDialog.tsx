'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ApproverSelect } from './ApproverSelect';
import { initializeWorkflow } from '@/lib/approver-service';
import { ApiError } from '@/lib/api-client';
import { RotateCcw, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export interface ResubmitWorkflowDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
  contractTitle?: string | null;
  /** Existing approver sequence to preserve by default */
  existingApproverIds?: string[];
  onSuccess?: () => void;
}

export function ResubmitWorkflowDialog({
  isOpen,
  onClose,
  contractId,
  contractTitle,
  existingApproverIds = [],
  onSuccess,
}: ResubmitWorkflowDialogProps) {
  const [approverIds, setApproverIds] = useState<string[]>(existingApproverIds);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync existing approver IDs when dialog opens or existingApproverIds change
  useEffect(() => {
    if (isOpen) {
      setApproverIds(existingApproverIds);
      setErrorMessage(null);
    }
  }, [isOpen, existingApproverIds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (approverIds.length === 0) {
      setErrorMessage('Please assign at least one approver to resubmit the workflow.');
      return;
    }

    try {
      setIsSubmitting(true);

      // Call backend to re-initialize workflow for RETURNED contract
      await initializeWorkflow(contractId, approverIds);

      toast.success('Contract resubmitted for approval successfully.');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
        toast.error(err.message);
      } else {
        const fallbackMsg = 'Failed to resubmit contract for approval. Please try again.';
        setErrorMessage(fallbackMsg);
        toast.error(fallbackMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isSubmitting) {
      setErrorMessage(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <RotateCcw className="size-5 text-blue-600" />
              <DialogTitle>Resubmit Contract for Approval</DialogTitle>
            </div>

            <DialogDescription className="text-xs pt-1 leading-normal">
              {contractTitle ? (
                <span className="font-semibold text-foreground block mb-1">
                  Contract: {contractTitle}
                </span>
              ) : null}
              This contract was returned for changes. Resubmitting will reset the workflow to
              Level 1 and notify the first approver. Past approval decisions and comments will be
              preserved in the audit history.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <p className="leading-tight">{errorMessage}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground block">
              Approver Sequence *
            </label>
            <ApproverSelect
              value={approverIds}
              onChange={setApproverIds}
              disabled={isSubmitting}
              placeholder="Search and add approvers..."
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || approverIds.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              Resubmit for Approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
