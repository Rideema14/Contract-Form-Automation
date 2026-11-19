'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { ResubmitWorkflowDialog } from './ResubmitWorkflowDialog';
import type { ApprovalStepInChain } from '@/types/approval';

export interface ResubmitContractButtonProps {
  contractId: string;
  contractTitle?: string | null;
  status: string;
  approvalSteps?: ApprovalStepInChain[];
  onSuccess?: () => void;
  className?: string;
}

export function ResubmitContractButton({
  contractId,
  contractTitle,
  status,
  approvalSteps = [],
  onSuccess,
  className = '',
}: ResubmitContractButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Resubmission is only valid when status is RETURNED
  if (status !== 'RETURNED') {
    return null;
  }

  // Preserve existing approver sequence sorted by level
  const existingApproverIds = [...approvalSteps]
    .sort((a, b) => a.level - b.level)
    .map((step) => step.approverId);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/30 ${className}`}
      >
        <RotateCcw className="size-3.5" />
        <span>Resubmit for Approval</span>
      </Button>

      <ResubmitWorkflowDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        contractId={contractId}
        contractTitle={contractTitle}
        existingApproverIds={existingApproverIds}
        onSuccess={onSuccess}
      />
    </>
  );
}
