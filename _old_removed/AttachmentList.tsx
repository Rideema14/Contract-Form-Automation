"use client";

import { useCallback, useEffect, useState } from "react";
import { downloadAttachment, listAttachments } from "./attachments.api";
import type { Attachment } from "./types";

interface Props {
  contractFormId: string;
  /** Change this value (for example after an upload) to reload the list. */
  refreshKey?: number;
}

export default function AttachmentList({ contractFormId, refreshKey = 0 }: Props) {
  const [items, setItems] = useState<Attachment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await listAttachments(contractFormId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load attachments");
    }
  }, [contractFormId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (error) return <p role="alert" className="text-red-600">{error}</p>;
  if (!items) return <p>Loading attachments...</p>;
  if (items.length === 0) return <p>No attachments yet.</p>;

  return (
    <ul className="space-y-2">
      {items.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-4">
          <span>
            {a.filename} <small>({a.category.replace(/_/g, " ").toLowerCase()}, {Math.ceil(a.sizeBytes / 1024)} KB)</small>
          </span>
          <button
            type="button"
            onClick={() => downloadAttachment(contractFormId, a).catch((e) => setError(e.message))}
          >
            Download
          </button>
        </li>
      ))}
    </ul>
  );
}
