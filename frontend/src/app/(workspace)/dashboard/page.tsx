"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileEdit,
  Files,
  FileText,
  LoaderCircle,
  RotateCcw,
  Search,
} from "lucide-react";
import { apiGet, ApiError } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const STATUS_LABELS: Record<Contract["status"], string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  RETURNED: "Returned",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function statusBadgeVariant(status: Contract["status"]): "default" | "secondary" | "outline" {
  if (status === "APPROVED") return "default";
  if (status === "DRAFT") return "secondary";
  return "outline";
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

function formatAmount(contract: Contract): string {
  if (contract.contractAmount === null) return "—";
  return `${contract.currency?.code ?? contract.currencyId ?? ""} ${contract.contractAmount}`.trim();
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export default function DashboardPage() {
  const { authUser } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
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

  const loadDashboard = useCallback(() => {
    setLoading(true);
    setError("");
    apiGet<DashboardResponse>("/dashboard")
      .then(setData)
      .catch((caught) =>
        setError(caught instanceof ApiError ? caught.message : "Unable to load dashboard."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadDashboard();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadDashboard]);

  useEffect(() => {
    let cancelled = false;
    getReferenceData()
      .then((result) => {
        if (!cancelled) setDepartments(result.departments);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setDepartmentError(caught instanceof ApiError ? caught.message : "Unable to load departments.");
        }
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
          if (cancelled) return;
          setContracts([]);
          setRegisterError(caught instanceof ApiError ? caught.message : "Unable to load the contract register.");
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

  if (loading && !data) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center bg-muted/30">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-label="Loading dashboard" />
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
        <div className="mx-auto max-w-6xl">
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">Unable to load dashboard</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" onClick={loadDashboard}>
                Try again
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const cards = [
    {
      label: "All forms",
      count: data.counts.all,
      href: "/contracts",
      icon: Files,
      hint: "Total accessible",
    },
    {
      label: "Draft",
      count: data.counts.draft,
      href: "/contracts?status=DRAFT",
      icon: FileEdit,
      hint: "In progress",
    },
    {
      label: "Pending approval",
      count: data.counts.pending,
      href: "/contracts?status=PENDING_APPROVAL",
      icon: Clock,
      hint: "Awaiting review",
    },
    {
      label: "Approved",
      count: data.counts.approved,
      href: "/contracts?status=APPROVED",
      icon: CheckCircle2,
      hint: "Finalized",
    },
    {
      label: "Returned",
      count: data.counts.returned,
      href: "/contracts?status=RETURNED",
      icon: RotateCcw,
      hint: "Needs changes",
    },
    {
      label: "Rejected",
      count: data.counts.rejected,
      href: "/contracts?status=REJECTED",
      icon: FileText,
      hint: "Not approved",
    },
  ] as const;

  const roleSubtitle =
    authUser?.role === "APPROVER"
      ? "Review assigned contracts and track approval progress."
      : authUser?.role === "ADMIN"
        ? "System-wide overview of contract forms, approvals, and activity."
        : "Create, edit, and track your contract forms from draft to approval.";

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Page Header */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Workspace Overview
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
              {authUser ? `Welcome back, ${authUser.fullName}` : "Dashboard"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{roleSubtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {(authUser?.role === "APPROVER" || authUser?.role === "ADMIN") && (
              <Link href="/approvals" className={buttonVariants({ variant: "outline" })}>
                <Clock className="size-4" />
                Review queue
              </Link>
            )}
            <Link href="/contracts" className={buttonVariants({ variant: "outline" })}>
              View register
            </Link>
            <NewContractLink className={buttonVariants()}>
              <FileText className="size-4" />
              New contract
            </NewContractLink>
          </div>
        </div>

        {/* KPI Cards */}
        <section aria-label="Contract status summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {cards.map(({ label, count, href, icon: Icon, hint }) => (
            <Link
              key={label}
              href={href}
              className="group rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full border-border bg-card transition-all hover:border-foreground/40 hover:shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </CardTitle>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-4" />
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
                    {count}
                  </p>
                  <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{hint}</span>
                    <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>

        {/* Recent Contracts */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold">Recent contracts</CardTitle>
              <CardDescription>Latest contract activity in your workspace</CardDescription>
            </div>
            <Link
              href="/contracts"
              className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
            >
              View all
              <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data.recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <FileText className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">No contract forms yet</p>
                  <p className="text-xs text-muted-foreground">
                    Create a new contract form to start the approval workflow.
                  </p>
                </div>
                <NewContractLink className={buttonVariants({ size: "sm" })}>
                  <FileText className="size-4" />
                  Create contract
                </NewContractLink>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.recent.map((contract) => (
                  <Link
                    key={contract.id}
                    href={`/contracts/${contract.id}?return=${encodeURIComponent("/dashboard")}`}
                    className="group flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-foreground group-hover:underline">
                          {contract.title || "Untitled contract"}
                        </p>
                        {contract.referenceNo && (
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                            {contract.referenceNo}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {contract.createdBy?.fullName || "Unknown creator"}
                        {contract.sponsorDepartment?.name
                          ? ` · ${contract.sponsorDepartment.name}`
                          : ""}
                        {contract.contractAmount
                          ? ` · ${contract.currency?.code ?? ""} ${contract.contractAmount}`
                          : ""}
                        {contract.updatedAt
                          ? ` · Updated ${new Date(contract.updatedAt).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge variant={statusBadgeVariant(contract.status)}>
                        {STATUS_LABELS[contract.status] ?? contract.status.replaceAll("_", " ")}
                      </Badge>
                      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Contract register</CardTitle>
              <CardDescription>Search and filter the latest contracts.</CardDescription>
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
                    {Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
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
                        <TableCell><Badge variant={statusBadgeVariant(contract.status)}>{STATUS_LABELS[contract.status]}</Badge></TableCell>
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
