
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { apiPost, ApiError } from '@/lib/api-client';
import {
  CheckCircle2,
  RotateCcw,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface ApprovalActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: 'APPROVE' | 'RETURN' | 'REJECT' | null;
  stepId: string;
  contractTitle?: string | null;
  onSuccess: () => void;
}

interface ApprovalActionResponse {
  finalPdf?: {
    status: 'not_required' | 'generated' | 'failed';
    message?: string;
  };
}

export function ApprovalActionDialog({
  isOpen,
  onClose,
  actionType,
  stepId,
  contractTitle,
  onSuccess,
}: ApprovalActionDialogProps) {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!actionType) return null;

  const isApprove = actionType === 'APPROVE';
  const isReturn = actionType === 'RETURN';
  const isReject = actionType === 'REJECT';

  const titleText = isApprove
    ? 'Approve Contract'
    : isReturn
      ? 'Return Contract for Changes'
      : 'Reject Contract';

  const descriptionText = isApprove
    ? 'You are approving this contract request. If a subsequent approval level exists, it will advance to the next approver; otherwise, the contract will receive final approval.'
    : isReturn
      ? 'This contract will be returned to the submitter with status RETURNED. They will be notified with your feedback to make necessary revisions before resubmission.'
      : 'Rejecting this contract will permanently terminate the approval workflow and set the contract status to REJECTED. This action cannot be reversed.';

  const isCommentMandatory = isReturn || isReject;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedComment = comment.trim();

    if (isCommentMandatory && !trimmedComment) {
      setErrorMessage(
        isReturn
          ? 'Revision comments are required so the creator knows what to modify.'
          : 'Rejection comments are required to document the procurement decision.'
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const endpoint = isApprove
        ? `/approvals/${stepId}/approve`
        : isReturn
          ? `/approvals/${stepId}/return`
          : `/approvals/${stepId}/reject`;

      const result = await apiPost<ApprovalActionResponse>(endpoint, {
        comment: trimmedComment || null,
      });

      if (result.finalPdf?.status === 'failed') {
        toast.error(result.finalPdf.message ?? 'The contract was approved, but its PDF could not be generated.');
      } else {
        toast.success(
          isApprove
            ? 'Contract approved successfully'
            : isReturn
              ? 'Contract returned to creator for changes'
              : 'Contract rejected'
        );
      }

      setComment('');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
        toast.error(err.message);
      } else {
        const fallbackMsg =
          'Failed to process approval action. Please try again.';
        setErrorMessage(fallbackMsg);
        toast.error(fallbackMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isSubmitting) {
      setComment('');
      setErrorMessage(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {isApprove && (
                <CheckCircle2 className="size-5 text-emerald-600" />
              )}
              {isReturn && (
                <RotateCcw className="size-5 text-blue-600" />
              )}
              {isReject && (
                <XCircle className="size-5 text-rose-600" />
              )}
              <DialogTitle>{titleText}</DialogTitle>
            </div>

            <DialogDescription className="text-xs pt-1 leading-normal">
              {contractTitle ? (
                <span className="font-semibold text-foreground block mb-1">
                  Contract: {contractTitle}
                </span>
              ) : null}
              {descriptionText}
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <p className="leading-tight">{errorMessage}</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="action-comment" className="text-xs font-medium">
                {isCommentMandatory
                  ? 'Mandatory Remarks / Comments *'
                  : 'Comments / Remarks (Optional)'}
              </Label>

              {isCommentMandatory && (
                <span className="text-[11px] text-muted-foreground">
                  Required
                </span>
              )}
            </div>

            <Textarea
              id="action-comment"
              rows={4}
              placeholder={
                isApprove
                  ? 'Add optional notes or approval justification...'
                  : isReturn
                    ? 'Detail the exact corrections, revisions, or missing items required...'
                    : 'Specify the justification for contract rejection...'
              }
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isSubmitting}
              className="text-xs resize-none"
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
              disabled={isSubmitting}
              className={
                isApprove
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : isReturn
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
              }
            >
              {isSubmitting && (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              )}

              {isApprove
                ? 'Approve Contract'
                : isReturn
                  ? 'Return for Changes'
                  : 'Reject Contract'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
