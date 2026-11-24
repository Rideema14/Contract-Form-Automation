"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileEdit,
  Files,
  FileText,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { apiGet, ApiError } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { NewContractLink } from "@/components/contracts/NewContractLink";
import type { Contract } from "@/types/contracts";

type DashboardResponse = {
  counts: {
    all: number;
    draft: number;
    pending: number;
    approved: number;
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

export default function DashboardPage() {
  const { authUser } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
      label: "Returned / rejected",
      count: data.counts.rejected,
      href: "/approvals",
      icon: RotateCcw,
      hint: "Needs attention",
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
        <section aria-label="Contract status summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
      </div>
    </main>
  );
}
