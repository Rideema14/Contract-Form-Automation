"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
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
import { NewContractLink } from "@/components/contracts/NewContractLink";
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
import { logout } from "@/services/auth";
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

function statusBadgeVariant(status: ContractStatus): "default" | "secondary" | "outline" {
  if (status === "APPROVED") return "default";
  if (status === "DRAFT") return "secondary";
  return "outline";
}

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
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const requestedStatus = searchParams.get("status");
  const initialStatus =
    requestedStatus && ["DRAFT", "PENDING_APPROVAL", "RETURNED", "APPROVED", "REJECTED"].includes(requestedStatus)
      ? requestedStatus as ContractStatus
      : "ALL";
  const [status, setStatus] = useState<ContractStatus | "ALL">(initialStatus);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionConfirmed, setDeletionConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isAdmin = authUser?.role === "ADMIN";
  const hasActiveFilters = Boolean(query) || status !== "ALL";

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

  function resetFilters() {
    setSearch("");
    setQuery("");
    setStatus("ALL");
    setPage(1);
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } catch (logoutError) {
      toast.error(
        logoutError instanceof ApiError
          ? logoutError.message
          : "Could not sign out.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function confirmDelete() {
    const canDelete =
      isAdmin ||
      (authUser?.role === "SUBMITTER" &&
        deleteTarget?.createdById === authUser.id);
    if (
      !deleteTarget ||
      deleteTarget.status !== "DRAFT" ||
      !canDelete ||
      deletionReason.trim().length < 10 ||
      !deletionConfirmed
    ) {
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
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Register
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
              {isAdmin ? "All contracts" : "My contract forms"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Search, filter, and inspect contract forms across every workflow stage.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadContracts()}
              disabled={isLoading}
            >
              <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
            >
              <LogOut className="size-4" />
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </Button>
            <NewContractLink className={buttonVariants()}>
              <Plus className="size-4" />
              New contract
            </NewContractLink>
          </div>
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-col gap-2 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Contract register</CardTitle>
              <CardDescription>
                Filter by workflow status or search by contract title and reference number.
              </CardDescription>
            </div>
            {!isLoading && !error && (
              <Badge variant="outline" className="w-fit font-mono text-xs">
                {pagination.totalItems} {pagination.totalItems === 1 ? "form" : "forms"}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <form
              className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_13rem_auto_auto] sm:items-end"
              onSubmit={submitSearch}
            >
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="contract-search" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Search
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
                  <Input
                    id="contract-search"
                    className="h-10 pl-9"
                    placeholder="Title or reference number..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="contract-status" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Status
                </Label>
                <Select value={status} onValueChange={changeStatus}>
                  <SelectTrigger id="contract-status" className="h-10 w-full">
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
              <Button type="submit" className="h-10">
                Search
              </Button>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  onClick={resetFilters}
                >
                  <X className="size-4" />
                  Clear
                </Button>
              )}
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
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-14 animate-pulse rounded-lg bg-muted"
                  />
                ))}
              </div>
            ) : contracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
                <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <FileText className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">No contracts found</p>
                  <p className="text-sm text-muted-foreground">
                    {hasActiveFilters
                      ? "No contract forms match your current search or status filter."
                      : "Get started by creating your first contract form."}
                  </p>
                </div>
                {hasActiveFilters ? (
                  <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                    Reset filters
                  </Button>
                ) : (
                  <NewContractLink className={buttonVariants({ size: "sm" })}>
                    <Plus className="size-4" />
                    New contract
                  </NewContractLink>
                )}
              </div>
            ) : (
              <>
              <div className="space-y-3 md:hidden">
                {contracts.map((contract) => {
                  const isDraft = contract.status === "DRAFT";
                  const canDelete =
                    isAdmin ||
                    (authUser?.role === "SUBMITTER" &&
                      contract.createdById === authUser.id);
                  return (
                    <Card key={`mobile-${contract.id}`} className="border-border">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <Link
                              href={`/contracts/${contract.id}?return=${encodeURIComponent("/contracts")}`}
                              className="block font-medium break-words hover:underline"
                            >
                              {contract.title || "Untitled contract"}
                            </Link>
                            <p className="font-mono text-xs text-muted-foreground">
                              {contract.referenceNo || "No reference number"}
                            </p>
                          </div>
                          <Badge variant={statusBadgeVariant(contract.status)}>
                            {statusLabels[contract.status]}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>Amount: {formatAmount(contract)}</span>
                          <span>Updated: {formatDate(contract.updatedAt)}</span>
                          <span>Vendor: {contract.recommendedVendor?.name ?? "—"}</span>
                          <span>Submitted: {contract.submittedAt ? formatDate(contract.submittedAt) : "—"}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Link href={`/contracts/${contract.id}?return=${encodeURIComponent("/contracts")}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                            <Eye className="size-3.5" />View
                          </Link>
                          {isDraft && (
                            <Link href={`/contracts/${contract.id}?edit=1&return=${encodeURIComponent("/contracts")}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                              <Pencil className="size-3.5" />Edit
                            </Link>
                          )}
                          {isDraft && canDelete && (
                            <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTarget(contract)}>
                              <Trash2 className="size-3.5" />Delete
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold">Contract</TableHead>
                    <TableHead className="font-semibold">Amount</TableHead>
                    <TableHead className="font-semibold">Department</TableHead>
                    <TableHead className="font-semibold">Category</TableHead>
                    <TableHead className="font-semibold">Vendor</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Submitted</TableHead>
                    <TableHead className="font-semibold">Updated</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => {
                    const isDraft = contract.status === "DRAFT";
                    const canDelete =
                      isAdmin ||
                      (authUser?.role === "SUBMITTER" &&
                        contract.createdById === authUser.id);
                    return (
                      <TableRow key={contract.id} className="hover:bg-muted/30">
                        <TableCell className="min-w-56">
                          <Link
                            href={`/contracts/${contract.id}?return=${encodeURIComponent("/contracts")}`}
                            className="block font-medium text-foreground hover:underline"
                          >
                            {contract.title || "Untitled contract"}
                          </Link>
                          <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {contract.referenceNo || "No reference number"}
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums whitespace-nowrap">
                          {formatAmount(contract)}
                        </TableCell>
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
                        <TableCell>{contract.recommendedVendor?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(contract.status)}>
                            {statusLabels[contract.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {contract.submittedAt ? formatDate(contract.submittedAt) : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(contract.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Link
                              href={`/contracts/${contract.id}?return=${encodeURIComponent("/contracts")}`}
                              className={buttonVariants({
                                variant: "ghost",
                                size: "icon-sm",
                              })}
                              aria-label={`View ${contract.title || "contract"}`}
                              title="View contract"
                            >
                              <Eye />
                            </Link>
                            {isDraft && (
                              <Link
                                href={`/contracts/${contract.id}?edit=1&return=${encodeURIComponent("/contracts")}`}
                                className={buttonVariants({
                                  variant: "ghost",
                                  size: "icon-sm",
                                })}
                                aria-label={`Edit ${contract.title || "contract"}`}
                                title="Edit draft"
                              >
                                <Pencil />
                              </Link>
                            )}
                            {isDraft && canDelete && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive"
                                aria-label={`Delete ${contract.title || "contract"}`}
                                title="Delete draft"
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
              </div>
              </>
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
                  <span className="min-w-20 text-center tabular-nums">
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
              I confirm that I am authorized to delete this draft.
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
