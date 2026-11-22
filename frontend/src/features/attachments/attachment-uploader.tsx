"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiErrorMessage } from "@/lib/api-client";
import { uploadAttachments } from "./attachments-api";
import type { Attachment, UploadableCategory, UploadLimits } from "./types";

const CATEGORIES: { value: UploadableCategory; label: string }[] = [
  { value: "SUPPORTING", label: "Supporting document" },
  { value: "COST_ESTIMATE_EXCEL", label: "Cost estimate (Excel)" },
];

type UploadStatus = "selected" | "uploading" | "uploaded" | "error";
interface PendingFile {
  id: string;
  file: File;
  displayName: string;
  status: UploadStatus;
  progress: number;
  preDraft: boolean;
  autoUpload: boolean;
  error?: string;
}

interface AttachmentUploaderProps {
  formId?: string;
  limits?: UploadLimits | null;
  onUploaded?: (attachments: Attachment[]) => void;
  onUploadStateChange?: (uploading: boolean) => void;
  onPreDraftPendingChange?: (pending: boolean) => void;
}

function fileError(file: File, category: UploadableCategory, limits: UploadLimits): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!limits.allowedExtensions.includes(extension)) return `.${extension || "unknown"} files are not allowed.`;
  if (category === "COST_ESTIMATE_EXCEL" && !["xls", "xlsx"].includes(extension)) {
    return "Cost estimates must be Excel files.";
  }
  if (file.size === 0) return "This file is empty.";
  if (file.size > limits.maxFileSizeBytes) return "This file exceeds the configured size limit.";
  return null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileType(file: File): string {
  return file.type || file.name.split(".").pop()?.toUpperCase() || "Unknown";
}

export function AttachmentUploader({ formId, limits, onUploaded, onUploadStateChange, onPreDraftPendingChange }: AttachmentUploaderProps) {
  const [category, setCategory] = useState<UploadableCategory>("SUPPORTING");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const uploadInProgress = useRef(false);

  const submit = useCallback(async (autoOnly = false) => {
    if (uploadInProgress.current || !formId || !limits) return;
    const candidates = files.filter((item) =>
      (item.status === "selected" || (!autoOnly && item.status === "error")) &&
      (!autoOnly || item.autoUpload)
    );
    if (candidates.length === 0) return;
    if (candidates.length > limits.maxFileCount) {
      const message = `You can upload at most ${limits.maxFileCount} files at once.`;
      setError(message);
      setFiles((current) => current.map((item) =>
        candidates.some((candidate) => candidate.id === item.id)
          ? { ...item, status: "error", autoUpload: false, error: message }
          : item
      ));
      return;
    }

    const invalid = candidates
      .map((item) => ({
        id: item.id,
        message: item.displayName.trim() ? fileError(item.file, category, limits) : "Enter a display name.",
      }))
      .filter((item): item is { id: string; message: string } => Boolean(item.message));
    if (invalid.length) {
      setError("Fix the file errors before uploading.");
      setFiles((current) => current.map((item) => {
        const problem = invalid.find((entry) => entry.id === item.id);
        return problem ? { ...item, status: "error", autoUpload: false, error: problem.message } : item;
      }));
      return;
    }

    uploadInProgress.current = true;
    setBusy(true);
    setError(null);
    if (autoOnly) {
      const candidateIds = new Set(candidates.map((item) => item.id));
      setFiles((current) => current.map((item) =>
        candidateIds.has(item.id) ? { ...item, autoUpload: false } : item
      ));
    }
    onUploadStateChange?.(true);
    const uploadedAttachments: Attachment[] = [];
    const failedIds = new Set<string>();
    let failedCount = 0;
    try {
      for (const item of candidates) {
        setFiles((current) => current.map((file) =>
          file.id === item.id ? { ...file, status: "uploading", progress: 0, error: undefined } : file
        ));
        try {
          const uploaded = await uploadAttachments(
            formId,
            category,
            [item.file],
            [item.displayName],
            (progress) => setFiles((current) => current.map((file) =>
              file.id === item.id ? { ...file, progress } : file
            )),
          );
          if (uploaded.length !== 1) {
            throw new Error("The server returned an incomplete upload result. Refresh the attachment list before retrying.");
          }
          uploadedAttachments.push(uploaded[0]);
          setFiles((current) => current.map((file) =>
            file.id === item.id ? { ...file, status: "uploaded", progress: 100 } : file
          ));
        } catch (caught) {
          failedCount += 1;
          failedIds.add(item.id);
          const message = apiErrorMessage(caught, "Upload failed.");
          setFiles((current) => current.map((file) =>
            file.id === item.id ? { ...file, status: "error", error: message } : file
          ));
        }
      }
      if (uploadedAttachments.length) onUploaded?.(uploadedAttachments);
      if (failedCount) {
        setError(`${failedCount} file${failedCount === 1 ? "" : "s"} could not be uploaded. See the file errors above.`);
      }
    } finally {
      uploadInProgress.current = false;
      setBusy(false);
      onUploadStateChange?.(false);
    }
    const candidateIds = new Set(candidates.map((item) => item.id));
    const hasUnresolvedPreDraftFiles = files.some((item) =>
      item.preDraft &&
      item.status !== "uploaded" &&
      (!candidateIds.has(item.id) || failedIds.has(item.id))
    );
    if (!hasUnresolvedPreDraftFiles) onPreDraftPendingChange?.(false);
  }, [files, formId, limits, onPreDraftPendingChange, onUploadStateChange, onUploaded, category]);

  useEffect(() => {
    if (!formId || !limits || !files.some((item) => item.autoUpload && item.status === "selected")) return;
    const timeoutId = window.setTimeout(() => {
      void submit(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [files, formId, limits, submit]);

  function removeFile(id: string) {
    const removed = files.find((item) => item.id === id);
    setFiles((current) => current.filter((item) => item.id !== id));
    setError(null);
    if (removed?.preDraft && !files.some((item) => item.id !== id && item.preDraft && item.status !== "uploaded")) {
      onPreDraftPendingChange?.(false);
    }
  }

  return (
    <div className="space-y-3">
      <select
        aria-label="Attachment category"
        className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
        value={category}
        onChange={(event) => setCategory(event.target.value as UploadableCategory)}
        disabled={busy || !formId}
      >
        {CATEGORIES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-muted/20 px-4 py-5 text-center hover:bg-muted/40">
        <span className="rounded-md border bg-background px-3 py-2 text-sm font-medium">Choose Files</span>
        <span className="text-xs text-muted-foreground">Select one or more documents</span>
        <input
          type="file"
          multiple
          aria-label="Files to upload"
          accept={limits?.allowedExtensions.map((extension) => `.${extension}`).join(",") ?? ".pdf"}
          disabled={busy}
          className="sr-only"
          onChange={(event) => {
          const selected = Array.from(event.currentTarget.files ?? []);
          if (selected.length) {
            setFiles((current) => [
              ...current,
              ...selected.map((file) => ({
                id: crypto.randomUUID(),
                file,
                displayName: file.name,
                status: "selected" as const,
                progress: 0,
                preDraft: !formId,
                autoUpload: !formId,
              })),
            ]);
            if (!formId) onPreDraftPendingChange?.(true);
            setError(null);
          }
          event.currentTarget.value = "";
          }}
        />
      </label>
      {files.length > 0 && (
        <div className="space-y-3">
          <ul aria-label="Selected documents" className="space-y-2">
            {files.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="break-all text-sm font-medium">Original filename: {item.file.name}</p>
                  <div className="space-y-1">
                    <Label htmlFor={`display-name-${item.id}`}>Display name</Label>
                    <Input
                      id={`display-name-${item.id}`}
                      value={item.displayName}
                      disabled={busy || item.status === "uploaded"}
                      maxLength={255}
                      onChange={(event) => setFiles((current) => current.map((file) =>
                        file.id === item.id ? { ...file, displayName: event.target.value, error: undefined } : file
                      ))}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Size: {formatSize(item.file.size)} · File type: {fileType(item.file)}
                  </p>
                  <p
                    role={item.status === "error" ? "alert" : "status"}
                    className={item.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
                  >
                    {item.status === "selected" && "Ready to upload"}
                    {item.status === "uploading" && `Uploading (${item.progress}%)`}
                    {item.status === "uploaded" && "Uploaded successfully"}
                    {item.status === "error" && (item.error ?? "Upload failed")}
                  </p>
                  {item.status === "uploading" && (
                    <progress aria-label={`Upload progress for ${item.file.name}`} max={100} value={item.progress} className="w-full" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || item.status === "uploading"}
                  onClick={() => removeFile(item.id)}
                >
                  {item.status === "uploaded" ? "Dismiss" : "Remove"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={!formId || !limits || busy || !files.some((item) => item.status === "selected" || item.status === "error")}
        >
          {busy ? "Uploading..." : "Upload Documents"}
        </Button>
        {files.some((item) => item.status === "uploaded") && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setFiles((current) => current.filter((item) => item.status !== "uploaded"))}
          >
            Clear completed
          </Button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
