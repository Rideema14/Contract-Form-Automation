"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
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
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit() {
    const problem = checkFiles(files, category, limits);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadAttachments(formId, category, files);
      onUploaded?.(uploaded);
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
      toast.success(
        uploaded.length === 1
          ? "Attachment uploaded."
          : `${uploaded.length} attachments uploaded.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <select
        aria-label="Attachment category"
        className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
        value={category}
        onChange={(event) => {
          const nextCategory = event.target.value as UploadableCategory;
          setCategory(nextCategory);
          setError(files.length ? checkFiles(files, nextCategory, limits) : null);
        }}
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
        ref={fileInput}
        accept={limits.allowedExtensions.map((extension) => `.${extension}`).join(",")}
        disabled={busy}
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? []);
          setFiles(selected);
          setError(selected.length ? checkFiles(selected, category, limits) : null);
        }}
      />
      {files.length ? (
        <p className="text-sm text-muted-foreground">
          {files.length} file{files.length === 1 ? "" : "s"} selected
        </p>
      ) : null}
      <Button type="button" onClick={submit} disabled={busy || files.length === 0}>
        {busy ? "Uploading..." : "Upload"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
