"use client";

import { useState } from "react";
import { uploadAttachments } from "./attachments.api";
import type { Attachment, AttachmentCategory, UploadLimits } from "./types";

const CATEGORIES: { value: Exclude<AttachmentCategory, "FINAL_PDF">; label: string }[] = [
  { value: "QUOTATION", label: "Quotation" },
  { value: "COST_ESTIMATE", label: "Cost estimate (Excel)" },
  { value: "TECHNICAL_DOCUMENT", label: "Technical document" },
  { value: "SUPPORTING_DOCUMENT", label: "Supporting document" },
];

interface Props {
  contractFormId: string;
  limits: UploadLimits;
  onUploaded?: (attachments: Attachment[]) => void;
}

function clientCheck(files: File[], limits: UploadLimits): string | null {
  if (files.length === 0) return "Choose at least one file.";
  if (files.length > limits.maxFileCount) return `You can upload at most ${limits.maxFileCount} files at once.`;
  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!limits.allowedExtensions.includes(ext)) return `"${file.name}": .${ext} files are not allowed.`;
    if (file.size === 0) return `"${file.name}" is empty.`;
    if (file.size > limits.maxFileSizeBytes) return `"${file.name}" is too large.`;
  }
  return null; // the server repeats every check; this is only for fast feedback
}

export default function AttachmentUploader({ contractFormId, limits, onUploaded }: Props) {
  const [category, setCategory] = useState<AttachmentCategory>("QUOTATION");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const problem = clientCheck(files, limits);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      onUploaded?.(await uploadAttachments(contractFormId, category, files));
      setFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <select value={category} onChange={(e) => setCategory(e.target.value as AttachmentCategory)} disabled={busy}>
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
      <input
        type="file"
        multiple
        accept={limits.allowedExtensions.map((e) => `.${e}`).join(",")}
        disabled={busy}
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
      <button type="button" onClick={submit} disabled={busy || files.length === 0}>
        {busy ? "Uploading..." : "Upload"}
      </button>
      {error && <p role="alert" className="text-red-600">{error}</p>}
    </div>
  );
}
