"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Eye, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadAttachment, listAttachments, viewAttachment } from "./attachments-api";
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

interface Preview {
  attachment: Attachment;
  blob: Blob;
}

type AttachmentListResult =
  | { requestKey: string; items: Attachment[] }
  | { requestKey: string; error: string };

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.ceil(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function AttachmentList({ formId, refreshKey = 0 }: AttachmentListProps) {
  const [retryKey, setRetryKey] = useState(0);
  const [listResult, setListResult] = useState<AttachmentListResult | null>(null);
  const [activeAction, setActiveAction] = useState<{
    id: string;
    type: "view" | "download";
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const requestKey = `${formId}:${refreshKey}:${retryKey}`;
  const currentResult =
    listResult?.requestKey === requestKey ? listResult : null;

  useEffect(() => {
    let cancelled = false;
    listAttachments(formId)
      .then((data) => {
        if (!cancelled) setListResult({ requestKey, items: data });
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setListResult({
            requestKey,
            error: errorMessage(caught, "Could not load attachments."),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [formId, refreshKey, requestKey, retryKey]);

  useEffect(() => {
    if (!preview || !previewFrame.current) return;

    const url = URL.createObjectURL(preview.blob);
    previewFrame.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [preview]);

  async function handleView(attachment: Attachment) {
    setActiveAction({ id: attachment.id, type: "view" });
    setActionError(null);
    try {
      setPreview({ attachment, blob: await viewAttachment(formId, attachment) });
    } catch (caught) {
      const message = errorMessage(caught, "Could not open this attachment.");
      setActionError(message);
      toast.error(message);
    } finally {
      setActiveAction(null);
    }
  }

  async function handleDownload(attachment: Attachment) {
    setActiveAction({ id: attachment.id, type: "download" });
    setActionError(null);
    try {
      await downloadAttachment(formId, attachment);
      toast.success("Download started.");
    } catch (caught) {
      const message = errorMessage(caught, "Could not download this attachment.");
      setActionError(message);
      toast.error(message);
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <>
      {!currentResult ? (
        <p className="text-sm text-muted-foreground">Loading attachments...</p>
      ) : "error" in currentResult ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">{currentResult.error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRetryKey((value) => value + 1)}
          >
            Retry
          </Button>
        </div>
      ) : currentResult.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      ) : (
        <>
          {actionError ? (
            <p role="alert" className="text-sm text-destructive">{actionError}</p>
          ) : null}
          <ul className="space-y-2">
            {currentResult.items.map((item) => {
              const isActive = activeAction?.id === item.id;
              return (
                <li
                  key={item.id}
                  className="flex flex-col justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
                >
                  <span className="min-w-0 break-all text-sm">
                    {item.fileName}{" "}
                    <span className="text-muted-foreground">
                      ({CATEGORY_LABELS[item.category]}, {formatSize(item.sizeBytes)})
                    </span>
                  </span>
                  <div className="flex shrink-0 gap-2">
                    {item.mimeType === "application/pdf" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={activeAction !== null}
                        onClick={() => void handleView(item)}
                      >
                        {isActive && activeAction.type === "view" ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <Eye />
                        )}
                        View
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={activeAction !== null}
                      onClick={() => void handleDownload(item)}
                    >
                      {isActive && activeAction.type === "download" ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Download />
                      )}
                      Download
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="h-[90vh] w-[min(1000px,calc(100vw-2rem))] max-w-none grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <DialogTitle className="break-all">
            {preview?.attachment.fileName ?? "PDF preview"}
          </DialogTitle>
          {preview ? (
            <iframe
              ref={previewFrame}
              title={`PDF preview: ${preview?.attachment.fileName ?? ""}`}
              className="h-full min-h-0 w-full rounded border"
            />
          ) : (
            <div className="flex items-center justify-center">
              <LoaderCircle className="animate-spin" aria-label="Loading PDF preview" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
