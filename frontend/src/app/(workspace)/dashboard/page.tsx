"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, FileText, LoaderCircle, Plus, RotateCcw } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      apiGet<DashboardResponse>("/dashboard")
        .then(setData)
        .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Unable to load dashboard."));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (error) return <main className="p-8 text-destructive">{error}</main>;
  if (!data) return <main className="flex min-h-[50vh] items-center justify-center"><LoaderCircle className="animate-spin" /></main>;

  const cards = [
    { label: "All forms", value: data.counts.all, icon: FileText },
    { label: "Draft", value: data.counts.draft, icon: Clock3 },
    { label: "Pending approval", value: data.counts.pending, icon: RotateCcw },
    { label: "Approved", value: data.counts.approved, icon: CheckCircle2 },
    { label: "Returned / rejected", value: data.counts.rejected, icon: RotateCcw },
  ] as const;
  const workflowStatuses = [
    { label: "Draft", value: data.counts.draft },
    { label: "Pending", value: data.counts.pending },
    { label: "Approved", value: data.counts.approved },
    { label: "Returned / rejected", value: data.counts.rejected },
  ] as const;
  const workflowTotal = workflowStatuses.reduce((total, item) => total + item.value, 0);

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <section className="flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="size-6" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Your workspace</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Contract overview</h1>
              <p className="mt-2 text-sm text-muted-foreground">A quick view of your forms and what needs attention.</p>
            </div>
          </div>
          <Link href="/contracts/new" className={buttonVariants({ className: "h-11 rounded-xl px-5 shadow-sm" })}>
              <Plus data-icon="inline-start" />
              Create contract
          </Link>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map(({ label, value, icon: Icon }) => (
            <Card key={label} className="gap-3 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-3 pb-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
                <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><Icon className="size-4" /></span>
              </CardHeader>
              <CardContent><p className="text-3xl font-semibold tracking-tight tabular-nums">{value.toLocaleString()}</p></CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Workflow snapshot</CardTitle>
            <p className="text-sm text-muted-foreground">See where your contract forms currently stand.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {workflowStatuses.map((item) => (
                <div key={item.label} className="rounded-lg border border-border/70 px-3 py-2.5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-semibold tabular-nums">{item.value.toLocaleString()}</span>
                  </div>
                  <div
                    role="img"
                    aria-label={`${item.label}: ${item.value} of ${workflowTotal} forms`}
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                  >
                    <span
                      className="block h-full rounded-full bg-primary/75"
                      style={{ width: workflowTotal ? `${(item.value / workflowTotal) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-end justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold">Recent contracts</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">The latest forms you can access.</p>
            </div>
            <Link href="/contracts" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View all <ArrowRight className="size-4" /></Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recent.length === 0 ? <p className="text-sm text-muted-foreground">No contract forms yet.</p> : data.recent.map((contract) => (
              <Link key={contract.id} href={`/contracts/${contract.id}`} className="group flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/70 p-4 transition-all hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-sm">
                <div>
                  <p className="font-semibold group-hover:text-primary">{contract.title || "Untitled contract"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{contract.referenceNo || "No reference number"} · {contract.createdBy?.fullName || "Unknown creator"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="rounded-full px-3 font-medium">{contract.status.replaceAll("_", " ")}</Badge>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
