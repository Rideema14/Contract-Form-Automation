"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api-client';
import type { ApprovalStepDetail, ApprovalHistoryResponse } from '@/types/approval';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApprovalStatusBadge } from '@/components/approvals/ApprovalStatusBadge';
import { ApprovalHistoryTimeline } from '@/components/approvals/ApprovalHistoryTimeline';
import { ApprovalActionDialog } from '@/components/approvals/ApprovalActionDialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, AlertCircle, RotateCcw, ArrowLeft, CheckCircle2, RotateCcw as ReturnIcon, XCircle } from 'lucide-react';

export default function ApprovalDetailPage() {
  const params = useParams<{ approvalId: string }>();
  const router = useRouter();
  const [stepDetail, setStepDetail] = useState<ApprovalStepDetail | null>(null);
  const [history, setHistory] = useState<ApprovalHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<'APPROVE' | 'RETURN' | 'REJECT'>('APPROVE');
  const { authUser, loading: authLoading } = useAuth();

  const loadData = useCallback(async () => {
    if (!params.approvalId) return;

    setLoading(true);
    setError(null);

    try {
      const detailRes = await apiGet<ApprovalStepDetail>(`/approvals/${params.approvalId}`);
      setStepDetail(detailRes);

if (detailRes.contractFormId) {
  const histRes = await apiGet<ApprovalHistoryResponse>(
    `/approvals/history/${detailRes.contractFormId}`
  );
  setHistory(histRes);
}
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load approval details';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [params.approvalId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshData = async () => {
    try {
      const refreshedDetail = await apiGet<ApprovalStepDetail>(`/approvals/${params.approvalId}`);
      setStepDetail(refreshedDetail);

if (refreshedDetail.contractFormId) {
  const refreshedHist = await apiGet<ApprovalHistoryResponse>(
    `/approvals/history/${refreshedDetail.contractFormId}`
  );
  setHistory(refreshedHist);
}
    } catch {
      toast.error('Failed to refresh approval data');
    }
  };

  const handleActionSuccess = async () => {
    await refreshData();
    setActionOpen(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="animate-spin size-8 text-primary" />
        <p className="text-xs text-muted-foreground">Loading approval details...</p>
      </div>
    );
  }

  if (error || !stepDetail) {
    return (
      <div className="container mx-auto p-6 max-w-lg space-y-4 pt-12">
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-destructive font-medium text-sm">
            <AlertCircle className="size-5 shrink-0" />
            <span>{error || 'Approval details not found'}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Could not retrieve approval step details. You may not have access or the record may have been removed.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/approvals')} className="gap-1.5">
              <ArrowLeft className="size-3.5" />
              <span>Back to Approvals</span>
            </Button>
            <Button variant="default" size="sm" onClick={loadData} className="gap-1.5">
              <RotateCcw className="size-3.5" />
              <span>Retry</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { contractForm, approver, status, level, actedAt } = stepDetail;
  const isCurrentApprover =
    !authLoading && !!authUser && status === 'PENDING' && authUser.id === approver.id;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Bar with Back Link */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/approvals')}
          className="gap-1 text-xs -ml-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Approvals</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={refreshData}
          className="gap-1.5 text-xs"
        >
          <RotateCcw className="size-3" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Contract & Approval Summary Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-lg sm:text-xl font-bold">
              {contractForm.title ?? 'Untitled Contract'}
            </CardTitle>
            {contractForm.referenceNo && (
              <p className="text-xs font-mono text-muted-foreground">
                Ref: {contractForm.referenceNo}
              </p>
            )}
          </div>
          <ApprovalStatusBadge status={status} />
        </CardHeader>

        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 text-xs border-t">
          <div>
            <span className="text-muted-foreground block text-[11px]">Submitted By</span>
            <span className="font-medium text-foreground">{contractForm.createdBy.fullName}</span>
            <span className="text-muted-foreground block text-[10px]">{contractForm.createdBy.email}</span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">Approval Stage</span>
            <span className="font-medium text-foreground">Level {level}</span>
            <span className="text-muted-foreground block text-[10px]">Assigned to: {approver.fullName}</span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">Submitted At</span>
            <span className="font-medium text-foreground">
              {new Date(contractForm.submittedAt ?? contractForm.createdAt).toLocaleString()}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">Decision Date</span>
            <span className="font-medium text-foreground">
              {actedAt ? new Date(actedAt).toLocaleString() : 'Pending Decision'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons Bar */}
      <div className="flex flex-wrap items-center gap-2 p-4 rounded-xl border bg-card shadow-xs">
        <span className="text-xs font-medium mr-2">Workflow Actions:</span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setActionType('APPROVE');
            setActionOpen(true);
          }}
          disabled={!isCurrentApprover}
          className="gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
        >
          <CheckCircle2 className="size-3.5" />
          <span>Approve</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setActionType('RETURN');
            setActionOpen(true);
          }}
          disabled={!isCurrentApprover}
          className="gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 border-blue-200 dark:border-blue-800"
        >
          <ReturnIcon className="size-3.5" />
          <span>Return for Changes</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setActionType('REJECT');
            setActionOpen(true);
          }}
          disabled={!isCurrentApprover}
          className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-800"
        >
          <XCircle className="size-3.5" />
          <span>Reject</span>
        </Button>

        {!isCurrentApprover && (
          <span className="text-[11px] text-muted-foreground ml-auto">
            {status !== 'PENDING'
              ? 'This approval step has already been acted upon.'
              : authUser?.id !== approver.id
                ? 'Only the assigned approver for this level can take action.'
                : ''}
          </span>
        )}
      </div>

      {/* History Timeline */}
      <ApprovalHistoryTimeline history={history} />

      {/* Action Dialog */}
      <ApprovalActionDialog
        isOpen={actionOpen}
        onClose={() => setActionOpen(false)}
        actionType={actionType}
        stepId={stepDetail.id}
        contractTitle={contractForm.title}
        onSuccess={handleActionSuccess}
      />
    </div>
  );
}
