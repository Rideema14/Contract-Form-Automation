import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiRequest, apiRequestWithMeta } from "@/lib/api-client";
import type {
  Bidder,
  Contract,
  ContractListResponse,
  ContractStatus,
  ContractDraft,
  CreateContractDraft,
  CostLine,
  Evaluation,
  FormSchemaDefinition,
  FormSchemaVersion,
  Quotation,
  ReferenceData,
} from "@/types/contracts";

export type ContractListParams = {
  page: number;
  pageSize: number;
  status?: ContractStatus;
  q?: string;
};

function toQueryString(params: ContractListParams): string {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });

  if (params.status) searchParams.set("status", params.status);
  if (params.q) searchParams.set("q", params.q);

  return searchParams.toString();
}

export function listContracts(
  params: ContractListParams,
): Promise<ContractListResponse> {
  return apiRequestWithMeta<{ items: ContractListResponse["items"] }>(
    `/forms?${toQueryString(params)}`,
  ).then((response) => ({
    items: response.data.items,
    pagination: response.meta?.pagination
      ? {
          page: response.meta.pagination.page,
          pageSize: response.meta.pagination.pageSize,
          totalItems: response.meta.pagination.totalItems,
          totalPages: response.meta.pagination.totalPages,
        }
      : undefined,
  }));
}

export function getContract(id: string): Promise<Contract> {
  return apiGet<Contract>(`/forms/${id}`);
}

export function createContract(body: CreateContractDraft): Promise<Contract> {
  return apiPost<Contract>("/forms", body);
}

export function getPublishedFormSchema(): Promise<FormSchemaVersion> {
  return apiGet<FormSchemaVersion>("/form-builder/published");
}

export function getFormSchemaDraft(): Promise<{
  draft: FormSchemaDefinition;
  latest: FormSchemaVersion;
}> {
  return apiGet<{ draft: FormSchemaDefinition; latest: FormSchemaVersion }>("/form-builder/draft");
}

export function saveFormSchemaDraft(definition: FormSchemaDefinition): Promise<unknown> {
  return apiPut("/form-builder/draft", definition);
}

export function publishFormSchema(): Promise<FormSchemaVersion> {
  return apiPost<FormSchemaVersion>("/form-builder/publish", {});
}

export function updateContract(id: string, body: ContractDraft): Promise<Contract> {
  return apiPatch<Contract>(`/forms/${id}`, body);
}

export function saveDraft(id: string, body: ContractDraft): Promise<Contract> {
  return apiPost<Contract>(`/forms/${id}/save-draft`, body);
}

export function deleteContract(
  id: string,
  body: { reason: string; confirm: true },
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/forms/${id}`, {
    method: "DELETE",
    body,
  });
}

export function submitContract(id: string, approverIds: string[]): Promise<Contract> {
  return apiPost<Contract>(`/forms/${id}/submit`, { approverIds });
}

export function getReferenceData(): Promise<ReferenceData> {
  return apiGet<ReferenceData>("/reference-data");
}

export function listBidders(formId: string): Promise<{ items: Bidder[] }> {
  return apiGet<{ items: Bidder[] }>(`/forms/${formId}/bidders`);
}

export function createBidder(formId: string, body: { vendorId?: string | null; companyName?: string; contactPerson?: string | null; email?: string | null; phone?: string | null; qualifications?: string | null; sortOrder?: number }): Promise<Bidder> {
  return apiPost<Bidder>(`/forms/${formId}/bidders`, body);
}

export function updateBidder(formId: string, bidderId: string, body: Partial<{ vendorId: string | null; companyName: string; contactPerson: string | null; email: string | null; phone: string | null; qualifications: string | null; sortOrder: number }>): Promise<Bidder> {
  return apiPatch<Bidder>(`/forms/${formId}/bidders/${bidderId}`, body);
}

export function deleteBidder(formId: string, bidderId: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/forms/${formId}/bidders/${bidderId}`);
}

export function createQuotation(formId: string, bidderId: string, body: { quotedAmount: string; currencyId?: string | null; quotationDate?: string | null; notes?: string | null }): Promise<Quotation> {
  return apiPost<Quotation>(`/forms/${formId}/bidders/${bidderId}/quotations`, body);
}

export function updateQuotation(formId: string, bidderId: string, quotationId: string, body: Partial<{ quotedAmount: string; currencyId: string | null; quotationDate: string | null; notes: string | null }>): Promise<Quotation> {
  return apiPatch<Quotation>(`/forms/${formId}/bidders/${bidderId}/quotations/${quotationId}`, body);
}

export function deleteQuotation(formId: string, bidderId: string, quotationId: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/forms/${formId}/bidders/${bidderId}/quotations/${quotationId}`);
}

export function createCostLine(formId: string, body: { description: string; quantity?: string | null; unitCost?: string | null; amount?: string; sortOrder: number }): Promise<CostLine> {
  return apiPost<CostLine>(`/forms/${formId}/cost-lines`, body);
}

export function updateCostLine(formId: string, lineId: string, body: Partial<{ description: string; quantity: string | null; unitCost: string | null; amount: string; sortOrder: number }>): Promise<CostLine> {
  return apiPatch<CostLine>(`/forms/${formId}/cost-lines/${lineId}`, body);
}

export function deleteCostLine(formId: string, lineId: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/forms/${formId}/cost-lines/${lineId}`);
}

export function saveEvaluations(formId: string, evaluations: Array<{ bidderId: string; type: "TECHNICAL" | "COMMERCIAL"; score?: string | null; remarks?: string | null }>): Promise<{ items: Evaluation[] }> {
  return apiPut<{ items: Evaluation[] }>(`/forms/${formId}/evaluations`, { evaluations });
}
