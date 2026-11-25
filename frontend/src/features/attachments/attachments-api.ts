import { API_BASE_URL, ApiError, apiGet, apiPost } from "@/lib/api-client";
import type { ApiErrorResponse, ApiSuccessResponse } from "@/types/api";
import type { Attachment, UploadableCategory, UploadLimits } from "./types";

const base = (formId: string) => `/forms/${encodeURIComponent(formId)}/attachments`;

function safeReference(referenceNo: string | null, formId: string): string {
  return (referenceNo ?? formId)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 100) || formId;
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function throwDownloadError(response: Response, fallback: string): Promise<never> {
  const payload: unknown = await response.json().catch(() => undefined);
  const error: ApiErrorResponse =
    payload && typeof payload === "object" && "message" in payload
      ? (payload as ApiErrorResponse)
      : { success: false, message: `${fallback} (${response.status})`, error: { code: "HTTP_ERROR", details: [] } };
  throw new ApiError(error, response.status);
}

export function getAttachmentLimits(formId: string): Promise<UploadLimits> {
  return apiGet<UploadLimits>(`/forms/${encodeURIComponent(formId)}/attachments/config`);
}

export async function downloadCurrentContractPdf(
  formId: string,
  referenceNo: string | null,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/forms/${encodeURIComponent(formId)}/pdf`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) await throwDownloadError(response, "PDF download failed");

  if (response.headers.get("content-type")?.split(";")[0].trim() !== "application/pdf") {
    throw new ApiError(
      { success: false, message: "The server did not return a PDF.", error: { code: "INVALID_PDF_RESPONSE", details: [] } },
      response.status,
    );
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new ApiError(
      { success: false, message: "The server returned an empty PDF.", error: { code: "EMPTY_PDF", details: [] } },
      response.status,
    );
  }

  saveBlob(blob, `Contract_${safeReference(referenceNo, formId)}_Current.pdf`);
}

export async function generateAndDownloadFinalPdf(formId: string): Promise<void> {
  const attachment = await apiPost<Attachment>(
    `/forms/${encodeURIComponent(formId)}/final-pdf/generate`,
    {},
  );
  await downloadAttachment(formId, attachment);
}

export async function downloadFinalPdfPackage(
  formId: string,
  referenceNo: string | null,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/forms/${encodeURIComponent(formId)}/final-pdf`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    await throwDownloadError(response, "Package generation failed");
  }

  if (response.headers.get("content-type")?.split(";")[0].trim() !== "application/zip") {
    throw new ApiError(
      { success: false, message: "The server did not return a ZIP package.", error: { code: "INVALID_PACKAGE_RESPONSE", details: [] } },
      response.status,
    );
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new ApiError(
      { success: false, message: "The server returned an empty ZIP package.", error: { code: "EMPTY_PACKAGE", details: [] } },
      response.status,
    );
  }

  saveBlob(blob, `Contract_${safeReference(referenceNo, formId)}_Full_Package.zip`);
}

export function listAttachments(formId: string): Promise<Attachment[]> {
  return apiGet<Attachment[]>(base(formId));
}

export async function deleteAttachment(formId: string, attachmentId: string): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE_URL}${base(formId)}/${encodeURIComponent(attachmentId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error: ApiErrorResponse =
      payload && typeof payload === "object" && "message" in payload
        ? (payload as ApiErrorResponse)
        : { success: false, message: `Delete failed (${response.status})`, error: { code: "HTTP_ERROR", details: [] } };
    throw new ApiError(error, response.status);
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("success" in payload) ||
    payload.success !== true ||
    !("data" in payload) ||
    typeof payload.data !== "object" ||
    payload.data === null ||
    !("id" in payload.data) ||
    typeof payload.data.id !== "string"
  ) {
    throw new Error("The server returned an invalid attachment deletion response.");
  }
  return { id: payload.data.id };
}

export function getAttachmentViewUrl(formId: string, attachmentId: string): string {
  return `${API_BASE_URL}${base(formId)}/${encodeURIComponent(attachmentId)}/view`;
}

/** Multipart upload. apiRequest only sends JSON, so this uses fetch directly with the same base URL and error type. */
export async function uploadAttachments(
  formId: string,
  category: UploadableCategory,
  files: File[],
  displayNames: string[] = files.map((file) => file.name),
  onProgress?: (percentage: number) => void,
): Promise<Attachment[]> {
  const body = new FormData();
  body.append("category", category); // text fields before files
  displayNames.forEach((name) => body.append("displayNames", name));
  files.forEach((file) => body.append("files", file));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new ApiError(
      { success: false, message: "The upload could not reach the server.", error: { code: "NETWORK_ERROR", details: [] } },
      xhr.status,
    ));
    xhr.onload = () => {
      let payload: unknown;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = undefined;
      }

      if (xhr.status < 200 || xhr.status >= 300 || !payload || typeof payload !== "object" || !("success" in payload) || payload.success !== true || !("data" in payload)) {
        const error: ApiErrorResponse =
          payload && typeof payload === "object" && "message" in payload
            ? (payload as ApiErrorResponse)
            : { success: false, message: `Upload failed (${xhr.status})`, error: { code: "HTTP_ERROR", details: [] } };
        reject(new ApiError(error, xhr.status));
        return;
      }
      resolve((payload as ApiSuccessResponse<Attachment[]>).data);
    };
    xhr.open("POST", `${API_BASE_URL}${base(formId)}`);
    xhr.withCredentials = true;
    xhr.send(body); // the browser supplies the multipart boundary
  });
}

/** Files are private: they are downloaded through the backend, never from a public Drive link. */
export async function downloadAttachment(
  formId: string,
  attachment: Pick<Attachment, "id" | "fileName">,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${base(formId)}/${encodeURIComponent(attachment.id)}/download`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiError(
      { success: false, message: `Download failed (${response.status})`, error: { code: "HTTP_ERROR", details: [] } },
      response.status,
    );
  }
  saveBlob(await response.blob(), attachment.fileName);
}
