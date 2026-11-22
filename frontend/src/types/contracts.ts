export type ContractStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "RETURNED"
  | "APPROVED"
  | "REJECTED";

export type Contract = {
  id: string;
  formSchemaVersionId: string;
  dynamicValues: DynamicValues;
  formSchemaVersion?: FormSchemaVersion;
  referenceNo: string | null;
  title: string | null;
  sponsorDepartmentId: string | null;
  contractCategoryId: string | null;
  scope: string | null;
  procurementRationale: string | null;
  contractAmount: string | null;
  currencyId: string | null;
  recommendedVendorId: string | null;
  recommendedBidderId: string | null;
  selectionRationale: string | null;
  status: ContractStatus;
  createdById: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sponsorDepartment?: { id: string; name: string };
  contractCategory?: { id: string; name: string };
  currency?: { id: string; code: string; name: string };
  recommendedVendor?: Vendor;
  recommendedBidder?: Bidder;
  createdBy?: { id: string; fullName: string; email: string; role: string };
  bidders?: Bidder[];
  evaluations?: Evaluation[];
  costLines?: CostLine[];
  attachments?: Attachment[];
  approvalSteps?: ApprovalStep[];
  approvalDecisions?: ApprovalDecision[];
  auditLogs?: { id: string; action: string; createdAt: string }[];
};

export type ContractDraft = {
  referenceNo?: string | null;
  title?: string | null;
  sponsorDepartmentId?: string | null;
  contractCategoryId?: string | null;
  scope?: string | null;
  procurementRationale?: string | null;
  contractAmount?: string | null;
  currencyId?: string | null;
  recommendedVendorId?: string | null;
  recommendedBidderId?: string | null;
  selectionRationale?: string | null;
  dynamicValues?: DynamicValues;
};

export type CreateContractDraft = ContractDraft & {
  formSchemaVersionId?: string;
};

export type FormFieldType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "EMAIL"
  | "DATE"
  | "DROPDOWN"
  | "MULTI_SELECT"
  | "RADIO"
  | "CHECKBOX";

export type DynamicValue = string | boolean | string[] | null;
export type DynamicValues = Record<string, DynamicValue>;

export type FormSchemaField = {
  id: string;
  label: string;
  type: FormFieldType;
  placeholder: string | null;
  helpText: string | null;
  required: boolean;
  defaultValue: DynamicValue;
  options: string[];
  sortOrder: number;
};

export type FormSchemaSection = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  fields: FormSchemaField[];
};

export type FormSchemaDefinition = {
  sections: FormSchemaSection[];
};

export type FormSchemaVersion = {
  id: string;
  version: number;
  definition: FormSchemaDefinition;
  publishedAt: string;
};

export type Vendor = {
  id: string;
  name: string;
  vendorType?: { id: string; name: string };
  contactDetails?: Record<string, unknown> | null;
};

export type Bidder = {
  id: string;
  vendorId: string | null;
  sortOrder: number;
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  qualifications: string | null;
  vendor: Vendor | null;
  quotations: Quotation[];
};

export type Quotation = {
  id: string;
  quotedAmount: string;
  currencyId: string | null;
  quotationDate: string | null;
  notes: string | null;
  currency?: { id: string; code: string; name: string } | null;
};

export type Evaluation = {
  id: string;
  bidderId: string;
  type: "TECHNICAL" | "COMMERCIAL";
  score: string | null;
  remarks: string | null;
  bidder?: { id: string; companyName: string; vendor: Vendor | null };
};

export type CostLine = {
  id: string;
  description: string;
  quantity: string | null;
  unitCost: string | null;
  amount: string;
  sortOrder: number;
};

export type Attachment = {
  id: string;
  category: string;
  fileName: string;
  originalFileName?: string | null;
  displayName?: string | null;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  createdAt: string;
};

export type ApprovalStep = {
  id: string;
  approverId?: string;
  level: number;
  status: string;
  actedAt: string | null;
  decisions: ApprovalDecision[];
};

export type ApprovalDecision = {
  id: string;
  decision: string;
  comment: string | null;
  createdAt: string;
};

export type ReferenceData = {
  departments: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  vendorTypes: { id: string; name: string }[];
  currencies: { id: string; code: string; name: string }[];
  vendors: Vendor[];
};

export type PaginationMetadata = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type ContractListResponse = {
  items: Contract[];
  pagination?: PaginationMetadata;
};
