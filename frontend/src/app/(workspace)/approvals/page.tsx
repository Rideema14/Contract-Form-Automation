"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api-client";
import type {
  ApprovalPendingItem,
  PaginationMeta,
  PendingApprovalsResponse,
} from "@/types/approval";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ApprovalStatusBadge } from "@/components/approvals/ApprovalStatusBadge";
import { toast } from "sonner";
import { Loader2, AlertCircle, RotateCcw, Inbox } from "lucide-react";

export default function ApprovalsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");

  const [pending, setPending] = useState<ApprovalPendingItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | undefined>(
    undefined
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiGet<PendingApprovalsResponse>(
        `/approvals/pending?page=${page}&pageSize=${pageSize}`
      );

      setPending(res.items);
      setPagination(res.meta?.pagination);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load pending approvals";

      setError(msg);
      toast.error(msg);
      setPending([]);
      setPagination(undefined);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchApprovals();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchApprovals]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.replace(`?${params.toString()}`);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-6">
        <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Approver workspace</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Pending approvals</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Review contract details and documents, then record your decision.
            </p>
        </div>
        <div>
          <Button
            variant="outline"
            onClick={fetchApprovals}
            disabled={loading}
            className="rounded-xl"
          >
            <RotateCcw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh queue</span>
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 border rounded-xl bg-card text-muted-foreground gap-3">
          <Loader2 className="animate-spin size-7 text-primary" />
          <p className="text-xs">Loading pending approvals...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center p-8 border border-destructive/20 bg-destructive/5 rounded-xl text-center space-y-3">
          <div className="flex items-center gap-2 text-destructive font-medium text-sm">
            <AlertCircle className="size-5 shrink-0" />
            <span>{error}</span>
          </div>

          <p className="text-xs text-muted-foreground">
            There was a problem retrieving your approvals queue.
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchApprovals}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            <span>Retry</span>
          </Button>
        </div>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border rounded-xl bg-card text-center space-y-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Inbox className="size-6 text-muted-foreground" />
          </div>

          <h3 className="font-semibold text-sm">No Pending Approvals</h3>

          <p className="text-xs text-muted-foreground max-w-sm">
            You do not have any contracts awaiting your review at this time.
          </p>
        </div>
      ) : (
        <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell className="font-semibold">Contract</TableCell>
                <TableCell className="font-semibold">Submitter</TableCell>
                <TableCell className="font-semibold">Level</TableCell>
                <TableCell className="font-semibold">Submitted At</TableCell>
                <TableCell className="font-semibold">Status</TableCell>
                <TableCell className="font-semibold text-right">
                  Action
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody>
              {pending.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">
                      {item.contractForm.title ?? "Untitled Contract"}
                    </div>

                    {item.contractForm.referenceNo && (
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {item.contractForm.referenceNo}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="text-xs">
                      {item.contractForm.createdBy.fullName}
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      {item.contractForm.createdBy.email}
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="font-medium text-xs">
                      Level {item.level}
                    </span>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(
                      item.contractForm.submittedAt ??
                        item.contractForm.createdAt
                    ).toLocaleString()}
                  </TableCell>

                  <TableCell>
                    <ApprovalStatusBadge status={item.status} />
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/approvals/${item.id}`)}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-between items-center text-xs text-muted-foreground pt-2">
          <span>
            Showing page {page} of {pagination.totalPages} (
            {pagination.totalItems} items)
          </span>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => handlePageChange(page - 1)}
            >
              Previous
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => handlePageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}