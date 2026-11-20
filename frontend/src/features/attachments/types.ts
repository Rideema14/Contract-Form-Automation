/** Matches AttachmentCategory in the backend schema. GENERATED_PDF is created by the system only. */
export type AttachmentCategory = "SUPPORTING" | "COST_ESTIMATE_EXCEL" | "GENERATED_PDF";
export type UploadableCategory = Exclude<AttachmentCategory, "GENERATED_PDF">;

export interface Attachment {
  id: string;
  contractFormId: string;
  category: AttachmentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  createdAt: string;
}

/**
 * Limits must come from the server configuration (still undecided, CL-14), so the
 * UI never hard-codes them. They are only used for fast feedback; the server
 * repeats every check.
 */
export interface UploadLimits {
  allowedExtensions: string[];
  maxFileSizeBytes: number;
  maxFileCount: number;
}
