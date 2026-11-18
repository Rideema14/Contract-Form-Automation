
"use client";

import React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {  ApiError, apiRequestWithMeta } from "@/lib/api-client";
import type { ApprovalPendingItem, PaginationMeta, PendingApprovalItem } from "@/types/approval";
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

export default function ApprovalsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");

  const [pending, setPending] = React.useState<ApprovalPendingItem[]>([]);
  const [pagination, setPagination] = React.useState<PaginationMeta | undefined>(
    undefined
  );
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchApprovals = async () => {
      setLoading(true);

      try {
        const res = await apiRequestWithMeta<PendingApprovalItem[]>(
  "/your-existing-approvals-endpoint"
);

setPending(res.data);
setPagination(res.meta?.pagination);
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(err.message);
        } else {
          toast.error("Failed to load pending approvals");
        }

        setPending([]);
        setPagination(undefined);
      } finally {
        setLoading(false);
      }
    };

    fetchApprovals();
  }, [page, pageSize]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.replace(`?${params.toString()}`);
  };

  if (loading) {
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Pending Approvals</h1>

      {pending.length === 0 ? (
        <p className="text-muted-foreground">
          No pending approvals found.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell>Contract</TableCell>
              <TableCell>Submitter</TableCell>
              <TableCell>Level</TableCell>
              <TableCell>Submitted At</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHeader>

          <TableBody>
            {pending.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  {item.contractForm.title ?? "Untitled Contract"}
                </TableCell>

                <TableCell>
                  {item.contractForm.createdBy.fullName}
                </TableCell>

                <TableCell>{item.level}</TableCell>

                <TableCell>
                  {new Date(item.contractForm.createdAt).toLocaleString()}
                </TableCell>

                <TableCell>
                  <ApprovalStatusBadge status={item.status} />
                </TableCell>

                <TableCell>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/approvals/${item.id}`)}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {pagination && pagination.totalPages > 0 && (
        <div className="flex justify-between items-center mt-4">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            Previous
          </Button>

          <span>
            Page {page} of {pagination.totalPages}
          </span>

          <Button
            variant="secondary"
            disabled={page >= pagination.totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
