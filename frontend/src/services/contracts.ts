import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiRequest, apiRequestWithMeta } from "@/lib/api-client";
import { ApiError, API_BASE_URL } from "@/lib/api-client";
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
import type { ApiErrorResponse, ApiSuccessResponse } from "@/types/api";

export type ContractListParams = {
  page: number;
  pageSize: number;
  status?: ContractStatus;
  departmentId?: string;
  q?: string;
  from?: string;
  to?: string;
};

function toQueryString(params: ContractListParams): string {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });

  if (params.status) searchParams.set("status", params.status);
  if (params.departmentId) searchParams.set("departmentId", params.departmentId);
  if (params.q) searchParams.set("q", params.q);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);

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

export function createBidder(formId: string, body: { vendorId?: string | null; vendorTypeId?: string | null; companyName?: string; contactPerson?: string | null; email?: string | null; phone?: string | null; qualifications?: string | null; sortOrder?: number }): Promise<Bidder> {
  return apiPost<Bidder>(`/forms/${formId}/bidders`, body);
}

export function updateBidder(formId: string, bidderId: string, body: Partial<{ vendorId: string | null; vendorTypeId: string | null; companyName: string; contactPerson: string | null; email: string | null; phone: string | null; qualifications: string | null; sortOrder: number }>): Promise<Bidder> {
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

function responseError(payload: unknown, status: number): Error {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "success" in payload &&
    payload.success === false &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return new ApiError(payload as ApiErrorResponse, status);
  }
  return new Error(`API request failed: ${status}`);
}

export async function downloadCostEstimateTemplate(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/forms/cost-estimate/template`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => undefined);
    throw responseError(payload, response.status);
  }

  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = "cost-estimate-template.xlsx";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function importCostEstimate(
  formId: string,
  file: File,
): Promise<CostLine[]> {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/forms/${encodeURIComponent(formId)}/cost-lines/import`,
    {
      method: "POST",
      credentials: "include",
      body,
      cache: "no-store",
    },
  );
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw responseError(payload, response.status);

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("success" in payload) ||
    payload.success !== true ||
    !("data" in payload) ||
    typeof payload.data !== "object" ||
    payload.data === null ||
    !("items" in payload.data) ||
    !Array.isArray(payload.data.items)
  ) {
    throw new Error("The server returned an invalid cost import response.");
  }

  return (payload as ApiSuccessResponse<{ items: CostLine[] }>).data.items;
}

export function saveEvaluations(formId: string, evaluations: Array<{ bidderId: string; type: "TECHNICAL" | "COMMERCIAL"; score?: string | null; remarks?: string | null }>): Promise<{ items: Evaluation[] }> {
  return apiPut<{ items: Evaluation[] }>(`/forms/${formId}/evaluations`, { evaluations });
}
