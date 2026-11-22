"use client";

import { useState } from "react";
import { FileUp, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadAttachments } from "./attachments-api";
import type { Attachment, UploadableCategory, UploadLimits } from "./types";

const CATEGORIES: { value: UploadableCategory; label: string }[] = [
  { value: "SUPPORTING", label: "Supporting document" },
  { value: "COST_ESTIMATE_EXCEL", label: "Cost estimate (Excel)" },
];

interface AttachmentUploaderProps {
  formId: string;
  limits: UploadLimits;
  onUploaded?: (attachments: Attachment[]) => void;
}

function checkFiles(files: File[], category: UploadableCategory, limits: UploadLimits): string | null {
  if (files.length === 0) return "Choose at least one file.";
  if (files.length > limits.maxFileCount) return `You can upload at most ${limits.maxFileCount} files at once.`;
  for (const file of files) {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!limits.allowedExtensions.includes(extension)) return `"${file.name}": .${extension} files are not allowed.`;
    if (category === "COST_ESTIMATE_EXCEL" && !["xls", "xlsx"].includes(extension)) {
      return `"${file.name}": cost estimates must be Excel files.`;
    }
    if (file.size === 0) return `"${file.name}" is empty.`;
    if (file.size > limits.maxFileSizeBytes) return `"${file.name}" is too large.`;
  }
  return null; // fast feedback only: the server repeats every check
}

export function AttachmentUploader({ formId, limits, onUploaded }: AttachmentUploaderProps) {
  const [category, setCategory] = useState<UploadableCategory>("SUPPORTING");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const problem = checkFiles(files, category, limits);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onUploaded?.(await uploadAttachments(formId, category, files));
      setFiles([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-primary/25 bg-primary/[0.035] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Paperclip className="size-5" />
        </span>
        <div>
          <h3 className="font-semibold">Add supporting documents</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Files are validated and stored privately. Choose a category and select one or more files.
          </p>
        </div>
      </div>
      <select
        aria-label="Attachment category"
        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-sm outline-none focus-visible:ring-4 focus-visible:ring-ring/15"
        value={category}
        onChange={(event) => setCategory(event.target.value as UploadableCategory)}
        disabled={busy}
      >
        {CATEGORIES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <input
        type="file"
        multiple
        aria-label="Files to upload"
        accept={limits.allowedExtensions.map((extension) => `.${extension}`).join(",")}
        disabled={busy}
        onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary"
      />
      {files.length > 0 && (
        <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
          {files.length} file{files.length === 1 ? "" : "s"} selected: {files.map((file) => file.name).join(", ")}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Allowed: {limits.allowedExtensions.map((extension) => `.${extension}`).join(", ")}
        </p>
        <Button type="button" onClick={submit} disabled={busy || files.length === 0} className="h-10 rounded-xl px-5">
          <FileUp className="size-4" />
          {busy ? "Uploading..." : "Upload files"}
        </Button>
      </div>
      {error ? <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
