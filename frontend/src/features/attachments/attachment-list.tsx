"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadAttachment, listAttachments } from "./attachments-api";
import type { Attachment } from "./types";

const CATEGORY_LABELS: Record<Attachment["category"], string> = {
  SUPPORTING: "Supporting document",
  COST_ESTIMATE_EXCEL: "Cost estimate (Excel)",
  GENERATED_PDF: "Final approved PDF",
};

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
        <li key={item.id} className="flex items-center justify-between gap-4">
          <span className="text-sm">
            {item.fileName}{" "}
            <span className="text-muted-foreground">
              ({CATEGORY_LABELS[item.category]}, {formatSize(item.sizeBytes)})
            </span>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadAttachment(formId, item).catch((caught: Error) => setError(caught.message))}
          >
            Download
          </Button>
        </li>
      ))}
    </ul>
  );
}
