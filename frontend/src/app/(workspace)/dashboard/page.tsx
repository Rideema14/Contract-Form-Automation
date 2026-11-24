"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, LoaderCircle } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
    ["All forms", data.counts.all, "/contracts"],
    ["Draft", data.counts.draft, "/contracts?status=DRAFT"],
    ["Pending approval", data.counts.pending, "/contracts?status=PENDING_APPROVAL"],
    ["Approved", data.counts.approved, "/contracts?status=APPROVED"],
    ["Returned / rejected", data.counts.rejected, "/approvals"],
  ] as const;

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Contract form overview</p>
          </div>
          <NewContractLink className={buttonVariants()}><FileText />New contract</NewContractLink>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                <Badge variant="outline">{contract.status.replaceAll("_", " ")}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
