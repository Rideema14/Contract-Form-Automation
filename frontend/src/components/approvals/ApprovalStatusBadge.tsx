import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ApprovalStatus, ContractStatus } from '@/types/approval';
import { CheckCircle2, Clock, RotateCcw, XCircle, Hourglass, FileText } from 'lucide-react';

interface ApprovalStatusBadgeProps {
  status: ApprovalStatus | ContractStatus;
  className?: string;
}

export function ApprovalStatusBadge({ status, className }: ApprovalStatusBadgeProps) {
  switch (status) {
    case 'PENDING':
    case 'PENDING_APPROVAL':
      return (
        <Badge
          variant="outline"
          className={`bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1 font-medium ${className || ''}`}
        >
          <Clock className="size-3 text-amber-500 animate-pulse" />
          Pending Approval
        </Badge>
      );
    case 'APPROVED':
      return (
        <Badge
          variant="outline"
          className={`bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1 font-medium ${className || ''}`}
        >
          <CheckCircle2 className="size-3 text-emerald-500" />
          Approved
        </Badge>
      );
    case 'RETURNED':
      return (
        <Badge
          variant="outline"
          className={`bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 flex items-center gap-1 font-medium ${className || ''}`}
        >
          <RotateCcw className="size-3 text-blue-500" />
          Returned for Changes
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge
          variant="outline"
          className={`bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 flex items-center gap-1 font-medium ${className || ''}`}
        >
          <XCircle className="size-3 text-rose-500" />
          Rejected
        </Badge>
      );
    case 'WAITING':
      return (
        <Badge
          variant="outline"
          className={`bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 flex items-center gap-1 font-medium ${className || ''}`}
        >
          <Hourglass className="size-3 text-slate-400" />
          Waiting
        </Badge>
      );
    case 'DRAFT':
    default:
      return (
        <Badge
          variant="outline"
          className={`bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-400 flex items-center gap-1 font-medium ${className || ''}`}
        >
          <FileText className="size-3 text-slate-400" />
          Draft
        </Badge>
      );
  }
}
