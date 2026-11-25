"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, FileText, LoaderCircle, Search } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { NewContractLink } from "@/components/contracts/NewContractLink";
import { getReferenceData, listContracts } from "@/services/contracts";
import type { Contract, ContractStatus } from "@/types/contracts";

type DashboardResponse = {
  counts: {
    all: number;
    draft: number;
    pending: number;
    approved: number;
    returned: number;
    rejected: number;
  };
  recent: Contract[];
};

const statusLabels: Record<ContractStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  RETURNED: "Returned",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

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

function formatAmount(contract: Contract): string {
  if (contract.contractAmount === null) return "—";
  return `${contract.currency?.code ?? contract.currencyId ?? ""} ${contract.contractAmount}`.trim();
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [departmentError, setDepartmentError] = useState("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [registerLoading, setRegisterLoading] = useState(true);
  const [registerError, setRegisterError] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ContractStatus | "ALL">("ALL");
  const [departmentId, setDepartmentId] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiGet<DashboardResponse>("/dashboard")
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(getErrorMessage(caught, "Unable to load dashboard."));
      });
    getReferenceData()
      .then((result) => {
        if (!cancelled) setDepartments(result.departments);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setDepartmentError(getErrorMessage(caught, "Unable to load departments."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (from && to && from > to) {
        setContracts([]);
        setRegisterError("The end date must be on or after the start date.");
        setRegisterLoading(false);
        return;
      }

      setRegisterLoading(true);
      setRegisterError("");
      listContracts({
        page: 1,
        pageSize: 6,
        q: query || undefined,
        status: status === "ALL" ? undefined : status,
        departmentId: departmentId === "ALL" ? undefined : departmentId,
        from: dateBound(from),
        to: dateBound(to, true),
      })
        .then((result) => {
          if (!cancelled) setContracts(result.items);
        })
        .catch((caught: unknown) => {
          if (!cancelled) {
            setContracts([]);
            setRegisterError(getErrorMessage(caught, "Unable to load the contract register."));
          }
        })
        .finally(() => {
          if (!cancelled) setRegisterLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [departmentId, from, query, status, to]);

  if (error) return <main className="p-8 text-destructive">{error}</main>;
  if (!data) return <main className="flex min-h-[50vh] items-center justify-center"><LoaderCircle className="animate-spin" /></main>;

  const cards = [
    ["Total", data.counts.all, "/contracts"],
    ["Draft", data.counts.draft, "/contracts?status=DRAFT"],
    ["Pending approval", data.counts.pending, "/contracts?status=PENDING_APPROVAL"],
    ["Approved", data.counts.approved, "/contracts?status=APPROVED"],
    ["Returned", data.counts.returned, "/contracts?status=RETURNED"],
    ["Rejected", data.counts.rejected, "/contracts?status=REJECTED"],
  ] as const;

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Contract form overview</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/approvals" className={buttonVariants({ variant: "outline" })}>Open approvals</Link>
            <NewContractLink className={buttonVariants()}><FileText />New contract</NewContractLink>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {cards.map(([label, count, href]) => (
            <Link key={label} href={href} className="rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/40">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">{count}</p></CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Recent contracts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.recent.length === 0 ? <p className="text-sm text-muted-foreground">No contract forms yet.</p> : data.recent.map((contract) => (
              <Link key={contract.id} href={`/contracts/${contract.id}?return=${encodeURIComponent("/dashboard")}`} className="flex flex-col gap-3 rounded-lg border p-3 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{contract.title || "Untitled contract"}</p>
                  <p className="text-xs text-muted-foreground">{contract.referenceNo || "No reference number"} · {contract.createdBy?.fullName || "Unknown creator"}</p>
                </div>
                <Badge variant="outline">{statusLabels[contract.status]}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Contract register</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Search and filter the latest contracts.</p>
            </div>
            <Link href="/contracts" className={buttonVariants({ variant: "outline", size: "sm" })}>View all contracts</Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                setQuery(search.trim());
              }}
            >
              <div className="flex min-w-0 flex-col gap-2 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="dashboard-contract-search">Search</Label>
                <div className="relative">
                  <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="dashboard-contract-search"
                    className="h-10 pl-8"
                    placeholder="Title, vendor, Form ID or reference"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="dashboard-contract-status">Status</Label>
                <Select value={status} onValueChange={(value) => setStatus((value ?? "ALL") as ContractStatus | "ALL")}>
                  <SelectTrigger id="dashboard-contract-status" className="h-10 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    {Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="dashboard-contract-department">Department</Label>
                <Select value={departmentId} onValueChange={(value) => setDepartmentId(value ?? "ALL")}>
                  <SelectTrigger id="dashboard-contract-department" className="h-10 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All departments</SelectItem>
                    {departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="dashboard-submitted-from">Submitted from</Label>
                <Input id="dashboard-submitted-from" className="h-10" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="dashboard-submitted-to">Submitted to</Label>
                <Input id="dashboard-submitted-to" className="h-10" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </div>
              <div className="flex items-end">
                <Button type="submit" variant="outline" className="h-10 w-full sm:w-auto">Search</Button>
              </div>
            </form>

            {departmentError && <p role="alert" className="text-sm text-destructive">{departmentError}</p>}
            {registerError ? (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{registerError}</p>
            ) : registerLoading ? (
              <div className="flex min-h-24 items-center justify-center" aria-label="Loading contract register">
                <LoaderCircle className="animate-spin" />
              </div>
            ) : contracts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No matching contracts.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Form ID / Reference</TableHead>
                      <TableHead>Contract title</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="max-w-40">
                          <span className="block truncate font-medium">{contract.referenceNo || contract.id}</span>
                          {contract.referenceNo && <span className="block truncate text-xs text-muted-foreground">{contract.id}</span>}
                        </TableCell>
                        <TableCell className="max-w-48 truncate">{contract.title || "Untitled contract"}</TableCell>
                        <TableCell>{contract.recommendedVendor?.name ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatAmount(contract)}</TableCell>
                        <TableCell><Badge variant={contract.status === "REJECTED" ? "destructive" : contract.status === "DRAFT" ? "secondary" : "outline"}>{statusLabels[contract.status]}</Badge></TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(contract.submittedAt)}</TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/contracts/${contract.id}?return=${encodeURIComponent("/dashboard")}`}
                            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                            aria-label={`View ${contract.title || "contract"}`}
                            title="View contract"
                          ><Eye /></Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
