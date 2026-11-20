import { API_BASE_URL, ApiError, apiGet } from "@/lib/api-client";
import type { ApiErrorResponse, ApiSuccessResponse } from "@/types/api";
import type { Attachment, UploadableCategory, UploadLimits } from "./types";

const base = (formId: string) => `/forms/${encodeURIComponent(formId)}/attachments`;

export function getAttachmentLimits(formId: string): Promise<UploadLimits> {
  return apiGet<UploadLimits>(`/forms/${encodeURIComponent(formId)}/attachments/config`);
}

export async function generateFinalPdf(formId: string): Promise<Attachment> {
  const response = await fetch(`${API_BASE_URL}/forms/${encodeURIComponent(formId)}/final-pdf`, {
    method: "POST",
    credentials: "include",
  });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error: ApiErrorResponse =
      payload && typeof payload === "object" && "message" in payload
        ? (payload as ApiErrorResponse)
        : { success: false, message: `PDF generation failed (${response.status})`, error: { code: "HTTP_ERROR", details: [] } };
    throw new ApiError(error, response.status);
  }
  return (payload as ApiSuccessResponse<Attachment>).data;
}

export function listAttachments(formId: string): Promise<Attachment[]> {
  return apiGet<Attachment[]>(base(formId));
}

/** Multipart upload. apiRequest only sends JSON, so this uses fetch directly with the same base URL and error type. */
export async function uploadAttachments(
  formId: string,
  category: UploadableCategory,
  files: File[],
): Promise<Attachment[]> {
  const body = new FormData();
  body.append("category", category); // text fields before files
  files.forEach((file) => body.append("files", file));

  const response = await fetch(`${API_BASE_URL}${base(formId)}`, {
    method: "POST",
    credentials: "include",
    body, // no Content-Type header: the browser adds the multipart boundary
  });
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error: ApiErrorResponse =
      payload && typeof payload === "object" && "message" in payload
        ? (payload as ApiErrorResponse)
        : { success: false, message: `Upload failed (${response.status})`, error: { code: "HTTP_ERROR", details: [] } };
    throw new ApiError(error, response.status);
  }
  return (payload as ApiSuccessResponse<Attachment[]>).data;
}

/** Files are private: they are downloaded through the backend, never from a public Drive link. */
export async function downloadAttachment(formId: string, attachment: Attachment): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${base(formId)}/${encodeURIComponent(attachment.id)}/download`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiError(
      { success: false, message: `Download failed (${response.status})`, error: { code: "HTTP_ERROR", details: [] } },
      response.status,
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.fileName;
  link.click();
  URL.revokeObjectURL(url);
}
