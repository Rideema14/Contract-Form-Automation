"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { apiErrorMessage, apiRequestWithMeta } from "@/lib/api-client";

const PAGE_SIZE = 20;

type AuditEntry = {
  id: string;
  actor: { fullName: string; email: string };
  action: string;
  entityType: string;
  entityId: string;
  contractForm: { title: string | null; referenceNo: string | null } | null;
  details: unknown;
  createdAt: string;
};

const ACTION_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  CONTRACT_CREATED: { label: "Contract Created", variant: "secondary" },
  CONTRACT_UPDATED: { label: "Contract Updated", variant: "outline" },
  CONTRACT_SUBMITTED: { label: "Submitted for Approval", variant: "default" },
  CONTRACT_RESUBMITTED: { label: "Resubmitted", variant: "default" },
  APPROVAL_STEP_APPROVED: { label: "Step Approved", variant: "default" },
  CONTRACT_FINAL_APPROVED: { label: "Final Approval", variant: "default" },
  CONTRACT_RETURNED: { label: "Returned for Revision", variant: "secondary" },
  CONTRACT_REJECTED: { label: "Rejected", variant: "destructive" },
  CONTRACT_DELETED: { label: "Contract Deleted", variant: "destructive" },
  USER_CREATED: { label: "User Created", variant: "secondary" },
  USER_ROLE_CHANGED: { label: "Role Changed", variant: "outline" },
  USER_STATUS_CHANGED: { label: "Status Changed", variant: "outline" },
  USER_UPDATED: { label: "User Updated", variant: "outline" },
  ATTACHMENT_UPLOADED: { label: "Document Uploaded", variant: "outline" },
  COST_LINE_CREATED: { label: "Cost Line Added", variant: "outline" },
  COST_LINE_UPDATED: { label: "Cost Line Updated", variant: "outline" },
  COST_LINE_DELETED: { label: "Cost Line Removed", variant: "outline" },
  BIDDER_CREATED: { label: "Bidder Added", variant: "outline" },
  BIDDER_UPDATED: { label: "Bidder Updated", variant: "outline" },
  BIDDER_DELETED: { label: "Bidder Removed", variant: "outline" },
  QUOTATION_CREATED: { label: "Quotation Added", variant: "outline" },
  QUOTATION_UPDATED: { label: "Quotation Updated", variant: "outline" },
  QUOTATION_DELETED: { label: "Quotation Removed", variant: "outline" },
  EVALUATIONS_UPDATED: { label: "Evaluation Recorded", variant: "outline" },
};

const FRIENDLY_FIELD_NAMES: Record<string, string> = {
  title: "Contract Title",
  referenceNo: "Reference Number",
  sponsorDepartmentId: "Sponsor Department",
  contractCategoryId: "Contract Category",
  contractAmount: "Contract Amount",
  currencyId: "Currency",
  scope: "Scope of Work",
  procurementRationale: "Procurement Rationale",
  selectionRationale: "Selection Rationale",
  recommendedBidderId: "Recommended Bidder",
  recommendedVendorId: "Recommended Vendor",
  dynamicValues: "Custom Form Fields",
  changedFields: "Modified Fields",
  reason: "Reason",
  comment: "Reviewer Comment",
  decision: "Approval Decision",
  level: "Approval Level",
  stepId: "Workflow Step",
  role: "User Role",
  isActive: "Account Status",
  finalStatus: "Final Status",
  sizeBytes: "File Size",
  fileName: "File Name",
  originalFileName: "Original File Name",
  mimeType: "File Type",
  category: "Document Category",
  score: "Evaluation Score",
  remarks: "Evaluation Remarks",
  quotedAmount: "Quoted Amount",
  quantity: "Quantity",
  unitCost: "Unit Cost",
  amount: "Total Amount",
  description: "Description",
  vendorId: "Vendor",
  companyName: "Company Name",
};

function humanize(value: string): string {
  if (FRIENDLY_FIELD_NAMES[value]) return FRIENDLY_FIELD_NAMES[value];
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown, key?: string): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Active / Yes" : "Inactive / No";
  if (key === "sizeBytes" && typeof value === "number") {
    return value < 1024 * 1024
      ? `${Math.max(1, Math.ceil(value / 1024))} KB`
      : `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "—";
}

function AuditDetailValue({ value, fieldKey }: { value: unknown; fieldKey?: string }): ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">None</span>;
    if (value.every((item) => typeof item === "string" || typeof item === "number")) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, index) => {
            const label = typeof item === "string" && FRIENDLY_FIELD_NAMES[item] ? FRIENDLY_FIELD_NAMES[item] : String(item);
            return (
              <Badge key={`${String(item)}-${index}`} variant="secondary" className="font-normal text-xs">
                {label}
              </Badge>
            );
          })}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="rounded-md border border-border bg-background p-3">
            <AuditDetailValue value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (isRecord(value)) {
    if ("from" in value && "to" in value) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-normal">{formatValue(value.from)}</Badge>
          <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <Badge variant="default" className="font-medium">{formatValue(value.to)}</Badge>
        </div>
      );
    }
    return <AuditDetailFields details={value} />;
  }

  return <span className="break-words font-medium">{formatValue(value, fieldKey)}</span>;
}

function AuditDetailFields({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details);
  if (entries.length === 0) return <span className="text-sm text-muted-foreground">No additional details recorded.</span>;

  return (
    <dl className="grid gap-2.5 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-2xs">
          <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {humanize(key)}
          </dt>
          <dd className="text-sm">
            <AuditDetailValue value={value} fieldKey={key} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function getInlineSummary(entry: AuditEntry): string | null {
  if (!isRecord(entry.details)) return null;
  const d = entry.details;
  if (Array.isArray(d.changedFields) && d.changedFields.length > 0) {
    const names = d.changedFields.map((f) => (typeof f === "string" && FRIENDLY_FIELD_NAMES[f]) ? FRIENDLY_FIELD_NAMES[f] : String(f));
    return `Updated ${names.length} ${names.length === 1 ? "field" : "fields"}: ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}`;
  }
  if (typeof d.reason === "string" && d.reason.trim()) {
    return `Reason: ${d.reason.slice(0, 60)}${d.reason.length > 60 ? "…" : ""}`;
  }
  if (typeof d.comment === "string" && d.comment.trim()) {
    return `Comment: ${d.comment.slice(0, 60)}${d.comment.length > 60 ? "…" : ""}`;
  }
  if (typeof d.to === "string" && typeof d.from === "string") {
    return `${d.from} → ${d.to}`;
  }
  if (typeof d.role === "string") {
    return `Role: ${d.role}`;
  }
  return null;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminAuditPage() {
  const router = useRouter();
  const { authUser, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  useEffect(() => {
    if (!authLoading && authUser?.role !== "ADMIN") router.replace("/dashboard");
  }, [authLoading, authUser, router]);

  const load = useCallback(async () => {
    if (authUser?.role !== "ADMIN") return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) params.set("q", query);
    try {
      const response = await apiRequestWithMeta<{ items: AuditEntry[] }>(`/admin/audit?${params}`);
      setEntries(response.data.items);
      setTotalPages(response.meta?.pagination?.totalPages ?? 0);
    } catch (caught) {
      setEntries([]);
      setError(apiErrorMessage(caught, "Could not load audit history."));
    } finally {
      setLoading(false);
    }
  }, [authUser, page, query]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  if (authLoading || authUser?.role !== "ADMIN") {
    return <main className="min-h-screen bg-muted/30 p-8"><p className="text-muted-foreground">Checking access...</p></main>;
  }

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Audit history</h1>
          <p className="text-muted-foreground">A clear timeline of changes made across contracts, users, and reference data.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Recorded events</CardTitle>
            <CardDescription>Search by action, entity, record ID, actor, or contract title/reference.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={submitSearch}>
              <div className="w-full max-w-lg space-y-2">
                <Label htmlFor="audit-search">Search history</Label>
                <div className="relative">
                  <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="audit-search"
                    className="pl-8"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Action, actor, form, or record ID"
                  />
                </div>
              </div>
              <Button type="submit" variant="outline">Search</Button>
            </form>

            {error ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <p role="alert">{error}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void load()}>Retry</Button>
              </div>
            ) : loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading audit history...</p>
            ) : entries.length === 0 ? (
              <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No audit records found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const actionMeta = ACTION_CONFIG[entry.action] ?? {
                        label: humanize(entry.action),
                        variant: "outline" as const,
                      };
                      const summary = getInlineSummary(entry);

                      return (
                        <TableRow key={entry.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                            {formatTimestamp(entry.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={actionMeta.variant} className="font-medium text-xs">
                              {actionMeta.label}
                            </Badge>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                              {humanize(entry.entityType)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm text-foreground">{entry.actor.fullName}</p>
                            <p className="text-xs text-muted-foreground">{entry.actor.email}</p>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm text-foreground">
                              {entry.contractForm?.title || entry.contractForm?.referenceNo || humanize(entry.entityType)}
                            </p>
                            <p className="break-all font-mono text-xs text-muted-foreground">
                              {entry.contractForm?.referenceNo || entry.entityId}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-start gap-1.5">
                              {summary && (
                                <span className="max-w-xs truncate text-xs text-muted-foreground" title={summary}>
                                  {summary}
                                </span>
                              )}
                              {entry.details != null ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs font-medium"
                                  onClick={() => setSelectedEntry(entry)}
                                >
                                  View details
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {!error && totalPages > 0 && (
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>
                  <ChevronLeft className="size-4" />Previous
                </Button>
                <span className="text-sm text-muted-foreground tabular-nums">Page {page} of {totalPages}</span>
                <Button type="button" variant="outline" size="sm" disabled={loading || page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                  Next<ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Dialog open={selectedEntry !== null} onOpenChange={(open) => { if (!open) setSelectedEntry(null); }}>
          {selectedEntry && (() => {
            const actionMeta = ACTION_CONFIG[selectedEntry.action] ?? {
              label: humanize(selectedEntry.action),
              variant: "outline" as const,
            };

            return (
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl border-border bg-card">
                <DialogHeader className="border-b border-border pb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={actionMeta.variant} className="text-xs font-semibold">
                      {actionMeta.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs font-mono text-muted-foreground">{humanize(selectedEntry.entityType)}</span>
                  </div>
                  <DialogTitle className="mt-2 text-xl font-bold tracking-tight">
                    Audit Record Details
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Recorded on {formatTimestamp(selectedEntry.createdAt)}
                  </DialogDescription>
                </DialogHeader>

                {/* Actor & Target Record Summary Box */}
                <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm sm:grid-cols-2">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Performed By
                    </p>
                    <p className="font-semibold text-foreground">{selectedEntry.actor.fullName}</p>
                    <p className="break-all font-mono text-xs text-muted-foreground">{selectedEntry.actor.email}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Associated Record
                    </p>
                    <p className="font-semibold text-foreground">
                      {selectedEntry.contractForm?.title || selectedEntry.contractForm?.referenceNo || humanize(selectedEntry.entityType)}
                    </p>
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {selectedEntry.contractForm?.referenceNo || selectedEntry.entityId}
                    </p>
                  </div>
                </div>

                {/* Event Details Content */}
                <section className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Recorded Data &amp; Field Changes
                    </h3>
                  </div>
                  {isRecord(selectedEntry.details) ? (
                    <AuditDetailFields details={selectedEntry.details} />
                  ) : (
                    <div className="rounded-lg border border-border bg-background p-4 text-sm">
                      <AuditDetailValue value={selectedEntry.details} />
                    </div>
                  )}
                </section>

                <DialogFooter className="border-t border-border pt-3">
                  <DialogClose render={<Button type="button" variant="outline">Close</Button>} />
                </DialogFooter>
              </DialogContent>
            );
          })()}
        </Dialog>
      </div>
    </main>
  );
}
