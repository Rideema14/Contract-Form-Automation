"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { deleteContract, listContracts } from "@/services/contracts";
import type {
  Contract,
  ContractStatus,
  PaginationMetadata,
} from "@/types/contracts";

const PAGE_SIZE = 10;

const statusLabels: Record<ContractStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  RETURNED: "Returned",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};
const statusTones: Record<ContractStatus, string> = {
  DRAFT: "bg-sky-100 text-sky-800",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  RETURNED: "bg-orange-100 text-orange-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
};

function formatAmount(contract: Contract): string {
  if (contract.contractAmount === null) return "—";
  return `${contract.currency?.code ?? contract.currencyId ?? ""} ${contract.contractAmount}`.trim();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Could not load contracts. Please try again.";
}

export default function ContractsPage() {
  const { authUser } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>({
    page: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ContractStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionConfirmed, setDeletionConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isAdmin = authUser?.role === "ADMIN";

  const loadContracts = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await listContracts({
        page,
        pageSize: PAGE_SIZE,
        q: query || undefined,
        status: status === "ALL" ? undefined : status,
      });
      setContracts(result.items);
      setPagination(
        result.pagination ?? {
          page,
          pageSize: PAGE_SIZE,
          totalItems: result.items.length,
          totalPages: result.items.length === PAGE_SIZE ? page + 1 : page,
        },
      );
    } catch (loadError) {
      setContracts([]);
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [page, query, status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadContracts();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadContracts]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  function changeStatus(value: string | null) {
    setStatus((value ?? "ALL") as ContractStatus | "ALL");
    setPage(1);
  }

  async function confirmDelete() {
    if (!deleteTarget || !isAdmin || deletionReason.trim().length < 10 || !deletionConfirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteContract(deleteTarget.id, {
        reason: deletionReason.trim(),
        confirm: true,
      });
      toast.success("Contract deleted. Audit history was retained.");
      setDeleteTarget(null);
      setDeletionReason("");
      setDeletionConfirmed(false);
      if (contracts.length === 1 && page > 1) {
        setPage((currentPage) => currentPage - 1);
      } else {
        await loadContracts();
      }
    } catch (deleteError) {
      toast.error(
        deleteError instanceof ApiError
          ? deleteError.message
          : "Could not delete the contract.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-6 lg:p-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="flex flex-wrap items-end justify-between gap-5 border-b border-border/70 pb-6">
          <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Contract register</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">My forms</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">Find a request, check its status, or continue working on a draft.</p>
          </div>
          <div className="flex flex-wrap gap-2">
              <Link href="/contracts/new" className={buttonVariants({ className: "h-10 rounded-xl px-4" })}>
                <Plus data-icon="inline-start" />
                New contract
              </Link>
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Contract register</CardTitle>
            <CardDescription>Search by title or reference, or filter by workflow status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={submitSearch}
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor="contract-search">Search</Label>
                <div className="relative">
                  <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="contract-search"
                    className="pl-8"
                    placeholder="Title or reference number"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2 sm:w-52">
                <Label htmlFor="contract-status">Status</Label>
                <Select value={status} onValueChange={changeStatus}>
                  <SelectTrigger id="contract-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" variant="outline">
                Search
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Refresh contracts"
                onClick={() => void loadContracts()}
              >
                <RefreshCw className={isLoading ? "animate-spin" : ""} />
              </Button>
            </form>

            {error ? (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadContracts()}
                >
                  Retry
                </Button>
              </div>
            ) : isLoading ? (
              <div className="space-y-3" aria-label="Loading contracts">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-12 animate-pulse rounded-md bg-muted"
                  />
                ))}
              </div>
            ) : contracts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center">
                <p className="font-medium">No contracts found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try changing your search or create a new contract.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => {
                    const isDraft = contract.status === "DRAFT";
                    return (
                      <TableRow key={contract.id}>
                        <TableCell className="min-w-52">
                          <div className="font-medium">
                            {contract.title || "Untitled contract"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {contract.referenceNo || "No reference number"}
                          </div>
                        </TableCell>
                        <TableCell>{formatAmount(contract)}</TableCell>
                        <TableCell>
                          {contract.sponsorDepartment?.name ??
                            contract.sponsorDepartmentId ??
                            "—"}
                        </TableCell>
                        <TableCell>
                          {contract.contractCategory?.name ??
                            contract.contractCategoryId ??
                            "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`rounded-full border-0 px-2.5 font-medium ${statusTones[contract.status]}`}>
                            {statusLabels[contract.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(contract.updatedAt)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Link
                              href={`/contracts/${contract.id}`}
                              className={buttonVariants({
                                variant: "ghost",
                                size: "icon-sm",
                              })}
                              aria-label={`View ${contract.title || "contract"}`}
                            >
                              <Eye />
                            </Link>
                            {isDraft && (
                              <>
                                <Link
                                  href={`/contracts/${contract.id}?edit=1`}
                                  className={buttonVariants({
                                    variant: "ghost",
                                    size: "icon-sm",
                                  })}
                                  aria-label={`Edit ${contract.title || "contract"}`}
                                >
                                  <Pencil />
                                </Link>
                              </>
                            )}
                            {isAdmin && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive"
                                aria-label={`Delete ${contract.title || "contract"}`}
                                onClick={() => setDeleteTarget(contract)}
                              >
                                <Trash2 />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {!isLoading && !error && pagination.totalItems > 0 && (
              <div className="flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">
                  Showing {Math.min((page - 1) * PAGE_SIZE + 1, pagination.totalItems)}–
                  {Math.min(page * PAGE_SIZE, pagination.totalItems)} of{" "}
                  {pagination.totalItems}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((currentPage) => currentPage - 1)}
                  >
                    <ChevronLeft />
                    Previous
                  </Button>
                  <span className="min-w-20 text-center">
                    Page {page} of {pagination.totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((currentPage) => currentPage + 1)}
                  >
                    Next
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
            setDeletionReason("");
            setDeletionConfirmed(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authorize contract deletion?</DialogTitle>
            <DialogDescription>
              This permanently removes the contract, approval decisions, and attached Drive files.
              Existing audit records and this deletion reason will be retained. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="deletion-reason">Reason (at least 10 characters)</Label>
              <Textarea
                id="deletion-reason"
                value={deletionReason}
                onChange={(event) => setDeletionReason(event.target.value)}
                maxLength={1000}
                required
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={deletionConfirmed}
                onChange={(event) => setDeletionConfirmed(event.target.checked)}
                className="mt-1"
              />
              I confirm I am authorized to approve this deletion.
            </label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={isDeleting} />}>
              Cancel
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={
                isDeleting ||
                deletionReason.trim().length < 10 ||
                !deletionConfirmed
              }
              onClick={() => void confirmDelete()}
            >
              {isDeleting ? "Deleting..." : "Approve and delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
