
import { apiGet, apiPost } from '@/lib/api-client';
import type { ApproverUser, ApproversResponse } from '@/types/approval';

/**
 * Fetches the list of active approvers from the backend.
 * Endpoint: GET /users/approvers
 */
export async function getActiveApprovers(): Promise<ApproverUser[]> {
  const response = await apiGet<ApproversResponse>('/users/approvers');

  return response.items ?? [];
}

/**
 * Initializes or resets the approval workflow for a given contract form.
 * Can be used for initial submission as well as resubmission of RETURNED contracts.
 * Endpoint: POST /approvals/workflow
 */
export async function initializeWorkflow(
  contractFormId: string,
  approverIds: string[]
) {
  return apiPost('/approvals/workflow', {
    contractFormId,
    approverIds,
  });
}