import React from 'react';
import { ApprovalHistoryResponse } from '@/types/approval';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';
import { CheckCircle2, RotateCcw, XCircle, Clock, User, Calendar, MessageSquare } from 'lucide-react';

interface ApprovalHistoryTimelineProps {
  history: ApprovalHistoryResponse | null;
  isLoading?: boolean;
}

export function ApprovalHistoryTimeline({ history, isLoading }: ApprovalHistoryTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 py-2">
        <div className="h-16 bg-muted/60 animate-pulse rounded-lg" />
        <div className="h-16 bg-muted/60 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!history || (!history.decisions?.length && !history.approvalSteps?.length)) {
    return (
      <div className="p-6 text-center text-muted-foreground border rounded-lg bg-muted/20">
        <Clock className="size-8 mx-auto mb-2 text-muted-foreground/60" />
        <p className="text-sm font-medium">No approval decisions recorded yet</p>
        <p className="text-xs mt-1">Decisions made by assigned approvers will appear here chronologically.</p>
      </div>
    );
  }

  const decisions = history.decisions || [];

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
      {decisions.length === 0 ? (
        <div className="relative">
          <div className="absolute -left-6 top-1 size-5 rounded-full border-2 border-amber-500 bg-background flex items-center justify-center">
            <div className="size-2 rounded-full bg-amber-500 animate-ping" />
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-2xs">
            <p className="text-sm font-medium text-foreground">Awaiting Initial Review</p>
            <p className="text-xs text-muted-foreground mt-1">
              The workflow has been submitted. Level 1 approver has been notified and decision is pending.
            </p>
          </div>
        </div>
      ) : (
        decisions.map((decision, index) => {
          const isApprove = decision.decision === 'APPROVED';
          const isReturn = decision.decision === 'RETURNED';
          const isReject = decision.decision === 'REJECTED';

          const stepInfo = history.approvalSteps?.find((s) => s.id === decision.approvalStepId);

          return (
            <div key={decision.id || index} className="relative group">
              {/* Timeline marker icon */}
              <div
                className={`absolute -left-6 top-1 size-5 rounded-full border-2 bg-background flex items-center justify-center ${
                  isApprove
                    ? 'border-emerald-500 text-emerald-500'
                    : isReturn
                    ? 'border-blue-500 text-blue-500'
                    : 'border-rose-500 text-rose-500'
                }`}
              >
                {isApprove && <CheckCircle2 className="size-3" />}
                {isReturn && <RotateCcw className="size-3" />}
                {isReject && <XCircle className="size-3" />}
              </div>

              {/* Event card */}
              <div className="rounded-lg border bg-card p-4 shadow-2xs space-y-2 hover:border-foreground/20 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {stepInfo ? `Level ${stepInfo.level} Approval` : 'Approval Decision'}
                    </span>
                    <ApprovalStatusBadge status={decision.decision} />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="size-3" />
                    <span>{new Date(decision.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="size-3.5" />
                  <span>Decided by:</span>
                  <span className="font-medium text-foreground">
                    {decision.actor?.fullName || stepInfo?.approver?.fullName || 'Assigned Approver'}
                  </span>
                  {(decision.actor?.email || stepInfo?.approver?.email) && (
                    <span className="text-muted-foreground/70">
                      ({decision.actor?.email || stepInfo?.approver?.email})
                    </span>
                  )}
                </div>

                {decision.comment ? (
                  <div className="mt-2 text-xs bg-muted/40 border border-muted/80 rounded-md p-2.5 flex items-start gap-2">
                    <MessageSquare className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">{decision.comment}</p>
                  </div>
                ) : (
                  <p className="text-xs italic text-muted-foreground/70">No comments provided.</p>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
