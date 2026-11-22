"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { apiGet, ApiError } from "@/lib/api-client";
import { listContracts } from "@/services/contracts";
import type { Contract } from "@/types/contracts";
import type { ApprovalPendingItem, PendingApprovalsResponse } from "@/types/approval";

type SubmitterTab = "pending" | "approved" | "returned" | "rejected";

const submitterTabs: { value: SubmitterTab; label: string }[] = [
  { value: "pending", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "returned", label: "Returned" },
  { value: "rejected", label: "Rejected" },
];

export default function ApprovalsPage() {
  const searchParams = useSearchParams();
  const { authUser, loading: authLoading } = useAuth();
  const requestedStatus = searchParams.get("status");
  const [tab, setTab] = useState<SubmitterTab>(
    submitterTabs.some((item) => item.value === requestedStatus) ? requestedStatus as SubmitterTab : "pending",
  );
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [pending, setPending] = useState<ApprovalPendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    setError("");
    try {
      if (authUser.role === "SUBMITTER") {
        const result = await listContracts({ page: 1, pageSize: 100 });
        setContracts(result.items);
      } else {
        const result = await apiGet<PendingApprovalsResponse>("/approvals/pending?page=1&pageSize=100");
        setPending(result.items);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load contract status.");
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (authLoading) return;
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [authLoading, load]);

  if (authLoading || loading) {
    return <main className="flex min-h-[50vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></main>;
  }

  if (authUser?.role !== "SUBMITTER") {
    return (
      <main className="container mx-auto space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div><h1 className="text-2xl font-bold">Pending Approvals</h1><p className="text-sm text-muted-foreground">Contracts awaiting your review.</p></div>
          <button type="button" className={buttonVariants({ variant: "outline", size: "sm" })} onClick={() => void load()}><RotateCcw className="size-4" />Refresh</button>
        </div>
        {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div> : pending.length === 0 ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No pending approvals.</CardContent></Card> : (
          <div className="space-y-3">{pending.map((item) => (
            <Card key={item.id}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{item.contractForm.title || "Untitled contract"}</p><p className="text-xs text-muted-foreground">{item.contractForm.referenceNo || "No reference number"} · Level {item.level}</p></div><Link href={`/approvals/${item.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Review</Link></CardContent></Card>
          ))}</div>
        )}
      </main>
    );
  }

  const tabContracts = contracts.filter((contract) => {
    if (tab === "pending") return contract.status === "PENDING_APPROVAL";
    return contract.status === tab.toUpperCase();
  });
  const highlightedContract = searchParams.get("contract");

  return (
    <main className="container mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Contract Status</h1><p className="text-sm text-muted-foreground">Track contracts submitted by you.</p></div>
        <button type="button" className={buttonVariants({ variant: "outline", size: "sm" })} onClick={() => void load()}><RotateCcw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
      </div>
      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="size-4" />{error}</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Contract status">
            {submitterTabs.map((item) => (
              <button key={item.value} type="button" role="tab" aria-selected={tab === item.value} onClick={() => setTab(item.value)} className={tab === item.value ? "rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" : "rounded-md border px-3 py-2 text-sm hover:bg-muted"}>
                {item.label}
              </button>
            ))}
          </div>
          {tabContracts.length === 0 ? (
            <Card><CardContent className="p-10 text-center"><p className="font-medium">No contracts in this status</p><p className="mt-1 text-sm text-muted-foreground">Submitted contracts will appear here.</p></CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {tabContracts.map((contract) => (
                <Card key={contract.id} id={`contract-${contract.id}`} className={highlightedContract === contract.id ? "ring-2 ring-primary" : ""}>
                  <CardHeader className="pb-3"><CardTitle className="text-base">{contract.title || "Untitled contract"}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="outline">{contract.status.replaceAll("_", " ")}</Badge><span className="text-xs text-muted-foreground">{contract.referenceNo || "No reference number"}</span></div>
                    <p className="text-xs text-muted-foreground">Submitted: {contract.submittedAt ? new Date(contract.submittedAt).toLocaleString() : "Not submitted"} · Updated: {new Date(contract.updatedAt).toLocaleString()}</p>
                    {(contract.status === "RETURNED" || contract.status === "REJECTED") && (contract.approvalDecisions?.length ?? 0) > 0 && (
                      <p className="text-sm">{contract.approvalDecisions?.[contract.approvalDecisions.length - 1]?.comment || "No reason/comment provided."}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/contracts/${contract.id}?return=${encodeURIComponent(`/approvals?status=${tab}`)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>View</Link>
                      {contract.status === "RETURNED" && <Link href={`/contracts/${contract.id}?edit=1&return=${encodeURIComponent(`/approvals?status=${tab}`)}`} className={buttonVariants({ size: "sm" })}>Edit and resubmit</Link>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
