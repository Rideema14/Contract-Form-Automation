import type { Attachment, AttachmentCategory } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message ?? `Request failed (${response.status})`);
  }
  return body as T;
}

export async function listAttachments(contractFormId: string): Promise<Attachment[]> {
  const res = await fetch(`${API_BASE_URL}/contracts/${encodeURIComponent(contractFormId)}/attachments`, {
    credentials: "include",
    cache: "no-store",
  });
  return (await parse<{ data: Attachment[] }>(res)).data;
}

export async function uploadAttachments(
  contractFormId: string,
  category: AttachmentCategory,
  files: File[]
): Promise<Attachment[]> {
  const form = new FormData();
  form.append("category", category); // text fields must come before files
  files.forEach((file) => form.append("files", file));
  const res = await fetch(`${API_BASE_URL}/contracts/${encodeURIComponent(contractFormId)}/attachments`, {
    method: "POST",
    credentials: "include",
    body: form, // no Content-Type header: the browser sets the multipart boundary
  });
  return (await parse<{ data: Attachment[] }>(res)).data;
}

/** Downloads through the backend (files are private; there are no public Drive links). */
export async function downloadAttachment(contractFormId: string, attachment: Attachment): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/contracts/${encodeURIComponent(contractFormId)}/attachments/${encodeURIComponent(attachment.id)}/download`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.filename;
  link.click();
  URL.revokeObjectURL(url);
}
