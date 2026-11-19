
export type ApprovalStatus =
  | 'WAITING'
  | 'PENDING'
  | 'APPROVED'
  | 'RETURNED'
  | 'REJECTED';

export type ContractStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'RETURNED'
  | 'APPROVED'
  | 'REJECTED';

export type ApprovalDecisionValue = 'APPROVED' | 'RETURNED' | 'REJECTED';

export type AttachmentCategory =
  | 'SUPPORTING'
  | 'COST_ESTIMATE_EXCEL'
  | 'GENERATED_PDF';

export type EvaluationType = 'TECHNICAL' | 'COMMERCIAL';

export interface ApproverSummary {
  id: string;
  fullName: string;
  email: string;
}

export interface ApproverUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}


export interface ApproversResponse {
  items: ApproverUser[];
}

export interface PendingApprovalsResponse {
  items: ApprovalPendingItem[];
  meta?: {
    pagination?: PaginationMeta;
  };
}


export interface ContractFormSummary {
  id: string;
  referenceNo: string | null;
  title: string | null;
  contractAmount: string | null;
  status: ContractStatus;
  createdAt: string;
  submittedAt: string | null;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
  sponsorDepartment: { id: string; name: string } | null;
  contractCategory: { id: string; name: string } | null;
  currency: { id: string; code: string; name: string } | null;
}

export interface PendingApprovalItem {
  id: string;
  contractFormId: string;
  level: number;
  status: ApprovalStatus;
  actedAt: string | null;
  contractForm: ContractFormSummary;
  approver: ApproverSummary;
}

export type ApprovalPendingItem = PendingApprovalItem;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ApprovalDecisionItem {
  id: string;
  approvalStepId: string;
  contractFormId: string;
  actorId: string;
  decision: ApprovalDecisionValue;
  comment: string | null;
  createdAt: string;
  actor?: ApproverSummary;
}

export interface ApprovalStepInChain {
  id: string;
  contractFormId: string;
  level: number;
  approverId: string;
  status: ApprovalStatus;
  actedAt: string | null;
  approver: ApproverSummary;
  decisions: ApprovalDecisionItem[];
}

export interface BidderItem {
  id: string;
  contractFormId: string;
  vendorId: string;
  sortOrder: number;
  vendor: {
    id: string;
    name: string;
    contactDetails?: Record<string, unknown> | null;
  };
  quotations: {
    id: string;
    quotedAmount: string;
    quotationDate: string | null;
    notes: string | null;
    currency?: { code: string; name: string } | null;
  }[];
}

export interface CostLineItem {
  id: string;
  description: string;
  quantity: string | null;
  unitCost: string | null;
  amount: string;
  sortOrder: number;
}

export interface AttachmentItem {
  id: string;
  category: AttachmentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  createdAt: string;
}

export interface DetailedContractForm extends ContractFormSummary {
  scope: string | null;
  procurementRationale: string | null;
  selectionRationale: string | null;
  recommendedVendor: { id: string; name: string } | null;
  bidders: BidderItem[];
  costLines: CostLineItem[];
  attachments: AttachmentItem[];
  approvalSteps: ApprovalStepInChain[];
}

export interface ApprovalStepDetail {
  id: string;
  contractFormId: string;
  level: number;
  approverId: string;
  status: ApprovalStatus;
  actedAt: string | null;
  approver: ApproverSummary;
  decisions: ApprovalDecisionItem[];
  contractForm: DetailedContractForm;
}

export interface ApprovalHistoryResponse {
  contractFormId: string;
  referenceNo: string | null;
  title: string | null;
  status: ContractStatus;
  approvalSteps: ApprovalStepInChain[];
  decisions: ApprovalDecisionItem[];
  auditTrail: {
    id: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    contractFormId: string | null;
    details: Record<string, unknown> | null;
    createdAt: string;
    actor?: ApproverSummary;
  }[];
}
