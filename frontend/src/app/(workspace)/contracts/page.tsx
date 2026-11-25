"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileDown,
  LogOut,
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
import { deleteContract, getReferenceData, listContracts } from "@/services/contracts";
import { downloadAttachment } from "@/features/attachments/attachments-api";
import type {
  Contract,
  ContractStatus,
  PaginationMetadata,
} from "@/types/contracts";

const PAGE_SIZE = 10;
const INITIAL_PAGINATION: PaginationMetadata = {
  page: 1,
  pageSize: PAGE_SIZE,
  totalItems: 0,
  totalPages: 0,
};

type DepartmentOption = { id: string; name: string };

const statusLabels: Record<ContractStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  RETURNED: "Returned",
  APPROVED: "Approved",
  REJECTED: "Rejected",
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

function formatSubmissionDate(value: string | null): string {
  return value ? formatDate(value) : "—";
}

function dateBound(value: string, endOfDay = false): string | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  ).toISOString();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Could not load contracts. Please try again.";
}

function normalizeDepartments(value: unknown): DepartmentOption[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): DepartmentOption[] => {
    if (typeof entry === "string") {
      const id = entry.trim();
      return id ? [{ id, name: id }] : [];
    }
    if (typeof entry !== "object" || entry === null) return [];

    const department = entry as {
      id?: unknown;
      departmentId?: unknown;
      name?: unknown;
      departmentName?: unknown;
    };
    const id =
      typeof department.id === "string"
        ? department.id
        : typeof department.departmentId === "string"
          ? department.departmentId
          : "";
    if (!id) return [];

    const name =
      typeof department.name === "string"
        ? department.name
        : typeof department.departmentName === "string"
          ? department.departmentName
          : id;
    return [{ id, name }];
  });
}

function getDepartmentId(value: unknown): string {
  if (typeof value === "string") return value || "ALL";
  if (typeof value !== "object" || value === null) return "ALL";

  const department = value as { id?: unknown; departmentId?: unknown };
  if (typeof department.id === "string") return department.id;
  if (typeof department.departmentId === "string") return department.departmentId;
  return "ALL";
}

export default function ContractsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authUser } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>(INITIAL_PAGINATION);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [departmentError, setDepartmentError] = useState("");
  const [departmentId, setDepartmentId] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const requestedStatus = searchParams.get("status");
  const initialStatus =
    requestedStatus && ["DRAFT", "PENDING_APPROVAL", "RETURNED", "APPROVED", "REJECTED"].includes(requestedStatus)
      ? requestedStatus as ContractStatus
      : "ALL";
  const [status, setStatus] = useState<ContractStatus | "ALL">(initialStatus);
  const [page, setPage] = useState(1);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionConfirmed, setDeletionConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const isAdmin = authUser?.role === "ADMIN";
  const contractsRequestVersion = useRef(0);

  const loadContracts = useCallback(async () => {
    const requestVersion = ++contractsRequestVersion.current;
    setIsLoading(true);
    setError("");

    if (from && to && from > to) {
      setContracts([]);
      setError("The end date must be on or after the start date.");
      if (requestVersion === contractsRequestVersion.current) setIsLoading(false);
      return;
    }

    try {
      const result = await listContracts({
        page,
        pageSize: PAGE_SIZE,
        q: query || undefined,
        status: status === "ALL" ? undefined : status,
        departmentId: departmentId === "ALL" ? undefined : departmentId,
        from: dateBound(from),
        to: dateBound(to, true),
      });
      if (requestVersion === contractsRequestVersion.current) {
        setContracts(result.items);
        setPagination(
          result.pagination ?? {
            page,
            pageSize: PAGE_SIZE,
            totalItems: result.items.length,
            totalPages: result.items.length === PAGE_SIZE ? page + 1 : page,
          },
        );
      }
    } catch (loadError) {
      if (requestVersion === contractsRequestVersion.current) {
        setContracts([]);
        setError(getErrorMessage(loadError));
      }
    } finally {
      if (requestVersion === contractsRequestVersion.current) setIsLoading(false);
    }
  }, [departmentId, from, page, query, status, to]);

  useEffect(() => {
    let cancelled = false;
    getReferenceData()
      .then((result) => {
        if (!cancelled) setDepartments(normalizeDepartments(result.departments));
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setDepartmentError(
            loadError instanceof ApiError
              ? loadError.message
              : "Could not load departments.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadContracts();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadContracts, reloadVersion]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  function changeStatus(value: string | null) {
    setStatus((value ?? "ALL") as ContractStatus | "ALL");
    setPage(1);
  }

  function refreshContracts() {
    contractsRequestVersion.current += 1;
    setSearch("");
    setQuery("");
    setStatus("ALL");
    setDepartmentId("ALL");
    setFrom("");
    setTo("");
    setPage(1);
    setPagination(INITIAL_PAGINATION);
    setContracts([]);
    setError("");
    setIsLoading(true);
    setReloadVersion((version) => version + 1);
  }

  async function downloadPdf(contract: Contract) {
    const pdf = contract.attachments?.find(
      (attachment) =>
        attachment.category === "GENERATED_PDF" &&
        attachment.mimeType === "application/pdf",
    );
    if (!pdf) return;

    setDownloadingPdfId(contract.id);
    try {
      await downloadAttachment(contract.id, pdf);
      toast.success("PDF downloaded.");
    } catch (downloadError) {
      toast.error(
        downloadError instanceof ApiError
          ? downloadError.message
          : "Could not download the PDF.",
      );
    } finally {
      setDownloadingPdfId(null);
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

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-6 lg:p-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My forms</h1>
            <p className="text-muted-foreground">
              View and manage your contract forms.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
            >
              <LogOut data-icon="inline-start" />
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </Button>
            <NewContractLink className={buttonVariants()}>
              <Plus data-icon="inline-start" />
              New contract
            </NewContractLink>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contract register</CardTitle>
            <CardDescription>
              Search by title, vendor, or reference and filter by status, department, and submission date.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_12rem_14rem_10rem_10rem_auto_auto] xl:items-end"
              onSubmit={submitSearch}
            >
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="contract-search">Search</Label>
                <div className="relative">
                  <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="contract-search"
                    className="h-10 pl-8"
                    placeholder="Title, vendor, Form ID or reference"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="contract-status">Status</Label>
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
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="contract-department">Department</Label>
                <Select
                  value={departmentId}
                  onValueChange={(value) => {
                    setDepartmentId(getDepartmentId(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    id="contract-department"
                    className="h-10 w-full min-w-0"
                    title={departmentId === "ALL"
                      ? "All departments"
                      : departments.find((department) => department.id === departmentId)?.name ?? "Department"}
                  >
                    <SelectValue className="min-w-0 flex-1 truncate text-left">
                      {departmentId === "ALL"
                        ? "All departments"
                        : departments.find((department) => department.id === departmentId)?.name ?? "Select department"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)]">
                    <SelectItem value="ALL">All departments</SelectItem>
                    {departments.map((department) => (
                      <SelectItem
                        key={department.id}
                        value={department.id}
                        className="min-w-0 max-w-[calc(100vw-3rem)]"
                      >
                        <span className="block min-w-0 truncate">{department.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="contract-submitted-from">Submitted from</Label>
                <Input
                  id="contract-submitted-from"
                  className="h-10"
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="contract-submitted-to">Submitted to</Label>
                <Input
                  id="contract-submitted-to"
                  className="h-10"
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Button type="submit" variant="outline" className="h-10">
                Search
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10"
                aria-label="Refresh contracts"
                onClick={refreshContracts}
                disabled={isLoading}
              >
                <RefreshCw className={isLoading ? "animate-spin" : ""} />
              </Button>
            </form>

            {departmentError && (
              <p role="alert" className="text-sm text-destructive">{departmentError}</p>
            )}
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
              <>
              <div className="space-y-3 md:hidden">
                {contracts.map((contract) => {
                  const isDraft = contract.status === "DRAFT";
                  const canDelete =
                    isAdmin ||
                    (authUser?.role === "SUBMITTER" &&
                      contract.createdById === authUser.id);
                  return (
                    <Card key={`mobile-${contract.id}`}>
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium break-words">{contract.title || "Untitled contract"}</p>
                            <p className="text-xs text-muted-foreground">{contract.referenceNo || "No reference number"}</p>
                          </div>
                          <Badge variant={contract.status === "REJECTED" ? "destructive" : contract.status === "DRAFT" ? "secondary" : "outline"}>
                            {statusLabels[contract.status]}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>Amount: {formatAmount(contract)}</span>
                          <span>Vendor: {contract.recommendedVendor?.name ?? "—"}</span>
                          <span>Department: {contract.sponsorDepartment?.name ?? "—"}</span>
                          <span>Submitted: {formatSubmissionDate(contract.submittedAt)}</span>
                          <span>Updated: {formatDate(contract.updatedAt)}</span>
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/contracts/${contract.id}?return=${encodeURIComponent("/contracts")}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                            <Eye />View
                          </Link>
                          {isDraft && (
                            <Link href={`/contracts/${contract.id}?edit=1&return=${encodeURIComponent("/contracts")}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                              <Pencil />Edit
                            </Link>
                          )}
                          {isDraft && canDelete && (
                            <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTarget(contract)}>
                              <Trash2 />Delete
                            </Button>
                          )}
                          {contract.attachments?.some((attachment) => attachment.category === "GENERATED_PDF" && attachment.mimeType === "application/pdf") && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={downloadingPdfId !== null}
                              onClick={() => void downloadPdf(contract)}
                            >
                              <FileDown />
                              {downloadingPdfId === contract.id ? "Downloading..." : "PDF"}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submission date</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                      <TableRow key={contract.id}>
                        <TableCell className="min-w-52">
                          <div className="font-medium">
                            {contract.title || "Untitled contract"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {contract.referenceNo || "No reference number"}
                          </div>
                        </TableCell>
                        <TableCell>{contract.recommendedVendor?.name ?? "—"}</TableCell>
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
                          <Badge
                            variant={
                              contract.status === "REJECTED"
                                ? "destructive"
                                : contract.status === "DRAFT"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {statusLabels[contract.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatSubmissionDate(contract.submittedAt)}</TableCell>
                        <TableCell>{formatDate(contract.updatedAt)}</TableCell>
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
                              <>
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
                              </>
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
                            {contract.attachments?.some((attachment) => attachment.category === "GENERATED_PDF" && attachment.mimeType === "application/pdf") && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Download PDF for ${contract.title || "contract"}`}
                                title="Download PDF"
                                disabled={downloadingPdfId !== null}
                                onClick={() => void downloadPdf(contract)}
                              >
                                <FileDown />
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
