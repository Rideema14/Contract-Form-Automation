"use client";

import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { downloadAttachment, getAttachmentViewUrl, listAttachments } from "./attachments-api";
import type { Attachment } from "./types";

const CATEGORY_LABELS: Record<Attachment["category"], string> = {
  SUPPORTING: "Supporting document",
  COST_ESTIMATE_EXCEL: "Cost estimate (Excel)",
  GENERATED_PDF: "Final approved PDF",
};

function isPreviewable(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}

interface AttachmentListProps {
  formId: string;
  /** Change this value (for example after an upload) to reload the list. */
  refreshKey?: number;
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({ formId, refreshKey = 0 }: AttachmentListProps) {
  const [items, setItems] = useState<Attachment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAttachments(formId)
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load attachments");
      });
    return () => {
      cancelled = true;
    };
  }, [formId, refreshKey]);

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!items) return <p className="text-sm text-muted-foreground">Loading attachments...</p>;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No attachments yet.</p>;

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
          <div className="min-w-0 text-sm">
            <p className="break-all font-medium">{item.displayName || item.fileName}</p>
            <p className="break-all text-xs text-muted-foreground">
              Original filename: {item.originalFileName || item.fileName}
            </p>
            <p className="text-muted-foreground">
              {CATEGORY_LABELS[item.category]} · {formatSize(item.sizeBytes)} · {item.mimeType}
            </p>
            <p className="text-xs text-muted-foreground">
              Uploaded by {item.uploadedById} · {new Date(item.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {isPreviewable(item.mimeType) && (
              <a
                href={getAttachmentViewUrl(formId, item.id)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                View
              </a>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadAttachment(formId, item).catch((caught: Error) => setError(caught.message))}
            >
              Download
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
