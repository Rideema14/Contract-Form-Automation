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

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "—";
}

function AuditDetailValue({ value }: { value: unknown }): ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">None</span>;
    if (value.every((item) => !isRecord(item) && !Array.isArray(item))) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, index) => (
            <Badge key={`${formatValue(item)}-${index}`} variant="secondary">{formatValue(item)}</Badge>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="rounded-md border bg-background p-3">
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
          <Badge variant="outline">{formatValue(value.from)}</Badge>
          <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <Badge>{formatValue(value.to)}</Badge>
        </div>
      );
    }
    return <AuditDetailFields details={value} />;
  }

  return <span className="break-words">{formatValue(value)}</span>;
}

function AuditDetailFields({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details);
  if (entries.length === 0) return <span className="text-sm text-muted-foreground">No additional details recorded.</span>;

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="min-w-0 rounded-lg border bg-background p-3">
          <dt className="mb-1 text-xs font-medium text-muted-foreground">{humanize(key)}</dt>
          <dd className="text-sm"><AuditDetailValue value={value} /></dd>
        </div>
      ))}
    </dl>
  );
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
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">{formatTimestamp(entry.createdAt)}</TableCell>
                        <TableCell>
                        <Badge variant="outline">{humanize(entry.action)}</Badge>
                        <p className="mt-1 text-xs text-muted-foreground">{humanize(entry.entityType)}</p>
                        </TableCell>
                        <TableCell>
                          <p>{entry.actor.fullName}</p>
                          <p className="text-xs text-muted-foreground">{entry.actor.email}</p>
                        </TableCell>
                        <TableCell>
                          <p>{entry.contractForm?.title || entry.contractForm?.referenceNo || entry.entityType}</p>
                          <p className="break-all text-xs text-muted-foreground">{entry.contractForm?.referenceNo || entry.entityId}</p>
                        </TableCell>
                        <TableCell>
                          {entry.details == null ? (
                            <span className="text-sm text-muted-foreground">No extra details</span>
                          ) : (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedEntry(entry)}>
                              View details
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!error && totalPages > 0 && (
              <div className="flex items-center justify-end gap-3">
                <Button type="button" variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>
                  <ChevronLeft />Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <Button type="button" variant="outline" size="sm" disabled={loading || page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                  Next<ChevronRight />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Dialog open={selectedEntry !== null} onOpenChange={(open) => { if (!open) setSelectedEntry(null); }}>
          {selectedEntry && (
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{humanize(selectedEntry.action)}</DialogTitle>
                <DialogDescription>
                  {humanize(selectedEntry.entityType)} event recorded {formatTimestamp(selectedEntry.createdAt)}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Changed by</p>
                  <p className="font-medium">{selectedEntry.actor.fullName}</p>
                  <p className="break-all text-xs text-muted-foreground">{selectedEntry.actor.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Related record</p>
                  <p className="font-medium">{selectedEntry.contractForm?.title || selectedEntry.contractForm?.referenceNo || humanize(selectedEntry.entityType)}</p>
                  <p className="break-all text-xs text-muted-foreground">
                    {selectedEntry.contractForm?.referenceNo || selectedEntry.entityId}
                  </p>
                </div>
              </div>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Event details</h3>
                {isRecord(selectedEntry.details) ? (
                  <AuditDetailFields details={selectedEntry.details} />
                ) : (
                  <div className="rounded-lg border p-3 text-sm">
                    <AuditDetailValue value={selectedEntry.details} />
                  </div>
                )}
              </section>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline">Close</Button>} />
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </main>
  );
}
