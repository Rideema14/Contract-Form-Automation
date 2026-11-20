import { apiGet, apiGetBlob, apiPost } from "@/lib/api-client";
import type { Attachment, UploadableCategory, UploadLimits } from "./types";

const base = (formId: string) => `/forms/${encodeURIComponent(formId)}/attachments`;

export function getAttachmentLimits(formId: string): Promise<UploadLimits> {
  return apiGet<UploadLimits>(`/forms/${encodeURIComponent(formId)}/attachments/config`);
}

export function generateFinalPdf(formId: string): Promise<Attachment> {
  return apiPost<Attachment>(`/forms/${encodeURIComponent(formId)}/final-pdf`);
}

export function listAttachments(formId: string): Promise<Attachment[]> {
  return apiGet<Attachment[]>(base(formId));
}

/** Multipart upload. The shared API client leaves FormData boundaries to the browser. */
export async function uploadAttachments(
  formId: string,
  category: UploadableCategory,
  files: File[],
): Promise<Attachment[]> {
  const body = new FormData();
  body.append("category", category);
  files.forEach((file) => body.append("files", file));
  return apiPost<Attachment[]>(base(formId), body);
}

/** Files are private: they are retrieved through the backend, never from a public Drive link. */
export function viewAttachment(formId: string, attachment: Attachment): Promise<Blob> {
  return apiGetBlob(
    `${base(formId)}/${encodeURIComponent(attachment.id)}/view`,
  );
}

export async function downloadAttachment(formId: string, attachment: Attachment): Promise<void> {
  const blob = await apiGetBlob(
    `${base(formId)}/${encodeURIComponent(attachment.id)}/download`,
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.fileName;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
