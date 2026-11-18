"use client";
import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiGet, apiPost, ApiError } from '@/lib/api-client';
import { ApprovalStepDetail, ApprovalHistoryResponse } from '@/types/approval';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApprovalStatusBadge } from '@/components/approvals/ApprovalStatusBadge';
import { ApprovalHistoryTimeline } from '@/components/approvals/ApprovalHistoryTimeline';
import { ApprovalActionDialog } from '@/components/approvals/ApprovalActionDialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface StepDetailResponse {
  success: boolean;
  data: ApprovalStepDetail;
}

interface HistoryResponse {
  success: boolean;
  data: ApprovalHistoryResponse;
}

export default function ApprovalDetailPage() {
  const params = useParams<{ approvalId: string }>();
  const router = useRouter();
  const [stepDetail, setStepDetail] = React.useState<ApprovalStepDetail | null>(null);
  const [history, setHistory] = React.useState<ApprovalHistoryResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionOpen, setActionOpen] = React.useState(false);
  const { authUser, loading: authLoading } = useAuth();

  // Compute approval permission after we have stepDetail and status
  // isCurrentApprover will be computed after stepDetail is loaded
  const [actionType, setActionType] = React.useState<'APPROVE' | 'RETURN' | 'REJECT'>('APPROVE');

  // Fetch detail and history
  React.useEffect(() => {
    (async () => {
      try {
        const detailRes: StepDetailResponse = await apiGet(`/approvals/${params.approvalId}`);
        setStepDetail(detailRes.data);
        // history endpoint uses contractFormId
        const histRes: HistoryResponse = await apiGet(`/approvals/history/${detailRes.data.contractFormId}`);
        setHistory(histRes.data);
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(err.message);
        } else {
          toast.error('Failed to load approval details');
        }
        router.replace('/approvals');
      } finally {
        setLoading(false);
      }
    })();
  }, [params.approvalId]);

  const handleAction = async (comment?: string) => {
    if (!stepDetail) return;
    const payload = { comment };
    let endpoint = '';
    switch (actionType) {
      case 'APPROVE':
        endpoint = `/approvals/${stepDetail.id}/approve`;
        break;
      case 'RETURN':
        endpoint = `/approvals/${stepDetail.id}/return`;
        break;
      case 'REJECT':
        endpoint = `/approvals/${stepDetail.id}/reject`;
        break;
    }
    try {
      await apiPost(endpoint, payload);
      toast.success(`${actionType} successful`);
      // Refresh detail and history
      const refreshedDetail: StepDetailResponse = await apiGet(`/approvals/${params.approvalId}`);
      setStepDetail(refreshedDetail.data);
      const refreshedHist: HistoryResponse = await apiGet(`/approvals/history/${refreshedDetail.data.contractFormId}`);
      setHistory(refreshedHist.data);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Action failed');
      }
    } finally {
      setActionOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin size-8 text-primary" />
      </div>
    );
  }

  if (!stepDetail) {
    return null; // should have been redirected on error
  }

  const { contractForm, approver, status, level, actedAt } = stepDetail;
  // Determine if the logged‑in user is the current approver for a pending step
  const isCurrentApprover =
    !authLoading && !!authUser && status === 'PENDING' && authUser.id === approver.id;

// Remove duplicate useAuth call and related vars
// const { authUser, loading: authLoading, error: authError } = useAuth();
// const isCurrentApprover =
//   !authLoading &&
//   !!authUser &&
//   status === 'PENDING' &&
//   authUser.id === approver.id;

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{contractForm.title ?? 'Untitled Contract'}</CardTitle>
          <ApprovalStatusBadge status={status} />
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <strong>Reference:</strong> {contractForm.referenceNo ?? '—'}
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Submitted By:</strong> {contractForm.createdBy.fullName} ({contractForm.createdBy.email})
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Level:</strong> {level}
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Submitted At:</strong> {new Date(contractForm.submittedAt ?? contractForm.createdAt).toLocaleString()}
          </p>
          {actedAt && (
            <p className="text-sm text-muted-foreground">
              <strong>Acted At:</strong> {new Date(actedAt).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6">
        <Button
          variant="outline"
          onClick={() => {
            setActionType('APPROVE');
            setActionOpen(true);
          }}
          disabled={!isCurrentApprover}
        >
          Approve
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setActionType('RETURN');
            setActionOpen(true);
          }}
          disabled={!isCurrentApprover}
        >
          Return
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            setActionType('REJECT');
            setActionOpen(true);
          }}
          disabled={!isCurrentApprover}
        >
          Reject
        </Button>
      </div>

      {/* History Timeline */}
      <ApprovalHistoryTimeline history={history} />

      <ApprovalActionDialog
        isOpen={actionOpen}
        onClose={() => setActionOpen(false)}
        actionType={actionType}
        stepId={stepDetail.id}
        contractTitle={contractForm.title}
        onSuccess={handleAction}
      />
    </div>
  );
}

