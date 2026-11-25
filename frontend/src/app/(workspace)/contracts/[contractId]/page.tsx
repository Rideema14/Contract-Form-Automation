"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Edit, LoaderCircle, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import { getContract } from "@/services/contracts";
import type { Contract, CostLine } from "@/types/contracts";
import { ContractEditor } from "@/features/contracts/contract-editor";
import { AttachmentList } from "@/features/attachments/attachment-list";
import { AttachmentUploader } from "@/features/attachments/attachment-uploader";
import { downloadFinalPdfPackage, getAttachmentLimits } from "@/features/attachments/attachments-api";
import type { UploadLimits } from "@/features/attachments/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const labels: Record<string, string> = { DRAFT: "Draft", PENDING_APPROVAL: "Pending approval", RETURNED: "Returned", APPROVED: "Approved", REJECTED: "Rejected" };
const submitterStatusTabs = new Set(["pending", "approved", "returned", "rejected"]);

function getReturnDestination(value: string | null): string {
  if (value === "/dashboard" || value === "/contracts") return value;
  if (value && /^\/approvals\/[a-zA-Z0-9_-]+$/.test(value)) return value;
  if (value?.startsWith("/approvals?")) {
    const status = new URLSearchParams(value.slice("/approvals?".length)).get("status");
    if (status && submitterStatusTabs.has(status)) return `/approvals?status=${status}`;
  }
  return "/contracts";
}

function sumCostLines(lines: CostLine[]) {
  return lines.reduce((sum, line) => sum + Number(line.amount || 0), 0).toFixed(4);
}

function approvalDisplayStatus(status: string) {
  if (status === "WAITING") return "NOT STARTED";
  return status;
}

function approvalBadgeClass(status: string) {
  if (status === "APPROVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "RETURNED") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "REJECTED") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "PENDING") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function approvalProgress(contract: Contract): { title: string; message: string } | null {
  const steps = [...(contract.approvalSteps ?? [])].sort(
    (a, b) => a.level - b.level,
  );
  if (contract.status === "APPROVED") {
    return {
      title: "Approval Complete",
      message: "All approval levels have approved this contract.",
    };
  }
  if (contract.status === "REJECTED") {
    const rejectingStep = [...steps].reverse().find((step) => step.status === "REJECTED");
    const decision = rejectingStep?.decisions?.[rejectingStep.decisions.length - 1];
    return {
      title: "Contract Rejected",
      message: decision?.comment
        ? `Level ${rejectingStep?.level ?? "—"} rejected this contract: ${decision.comment}`
        : `Level ${rejectingStep?.level ?? "—"} rejected this contract.`,
    };
  }
  if (contract.status === "RETURNED") {
    const returnedStep = [...steps].reverse().find((step) => step.status === "RETURNED");
    return {
      title: "Changes Required",
      message: returnedStep
        ? `Level ${returnedStep.level} has returned your contract for changes.`
        : "The contract has been returned for changes.",
    };
  }
  if (contract.status === "PENDING_APPROVAL") {
    const approvedSteps = steps.filter((step) => step.status === "APPROVED");
    const pendingStep = steps.find((step) => step.status === "PENDING");
    if (approvedSteps.length > 0 && pendingStep) {
      const latestApproved = approvedSteps[approvedSteps.length - 1];
      return {
        title: "Approval in Progress",
        message: `Level ${latestApproved.level} has approved your contract. It is now awaiting Level ${pendingStep.level} approval.`,
      };
    }
  }
  return null;
}

export default function ContractDetailPage() {
  const params = useParams<{ contractId: string }>();
  const searchParams = useSearchParams();
  const [contract, setContract] = useState<Contract | null>(null);
  const [error, setError] = useState("");
  const edit = searchParams.get("edit") === "1";
  const backHref = getReturnDestination(searchParams.get("return"));
  const requestKey = `${params.contractId}:${edit}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [limits, setLimits] = useState<UploadLimits | null>(null);
  const [attachmentRefresh, setAttachmentRefresh] = useState(0);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const { authUser } = useAuth();
  const view = searchParams.get("view") === "1";

  useEffect(() => {
    if (view) return;
    let active = true;
    getContract(params.contractId)
      .then((loaded) => {
        if (!active) return;
        setContract(loaded);
        setError("");
        setLoadedKey(requestKey);
        return getAttachmentLimits(params.contractId)
          .then((loadedLimits) => {
            if (active) setLimits(loadedLimits);
          })
          .catch(() => {
            if (active) setLimits(null);
          });
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof ApiError ? loadError.message : "Unable to load contract.");
        setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [params.contractId, edit, requestKey, view]);

  if (view) return <ContractEditor contractId={params.contractId} edit={false} readOnly returnTo={backHref} />;
  if (edit) return <ContractEditor contractId={params.contractId} edit returnTo={backHref} />;
  if (loadedKey !== requestKey) return <main className="flex min-h-screen items-center justify-center"><LoaderCircle className="animate-spin" /></main>;
  if (error) return <main className="p-8 text-destructive">{error}</main>;
  if (!contract) return <main className="flex min-h-screen items-center justify-center"><LoaderCircle className="animate-spin" /></main>;

  const bidders = contract.bidders ?? [];
  const lines = contract.costLines ?? [];
  const contractingBidder = contract.recommendedBidder
    ?? bidders.find((bidder) => bidder.vendorId === contract.recommendedVendorId);
  const subtotal = sumCostLines(lines);
  const approvalSteps = [...(contract.approvalSteps ?? [])].sort((a, b) => a.level - b.level);
  const fullyApproved = contract.status === "APPROVED" &&
    approvalSteps.length > 0 &&
    approvalSteps.every((step) => step.status === "APPROVED");
  const progress = approvalProgress(contract);
  return <main className="min-h-screen bg-muted/30 p-4 sm:p-8"><div className="mx-auto flex max-w-6xl flex-col gap-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back</Link><h1 className="mt-2 text-2xl font-bold sm:text-3xl">{contract.title || "Untitled contract"}</h1><p className="text-sm text-muted-foreground">{contract.referenceNo || "No reference number"}</p></div><div className="flex items-center gap-2"><Badge>{labels[contract.status]}</Badge>{(contract.status === "DRAFT" || contract.status === "RETURNED") && <Link href={`/contracts/${contract.id}?edit=1&return=${encodeURIComponent(backHref)}`} className={buttonVariants()}><Edit />Edit</Link>}{fullyApproved && (authUser?.role === "ADMIN" || authUser?.role === "APPROVER") && <button type="button" className={buttonVariants({ variant: "outline" })} disabled={generatingPdf} onClick={async () => { setGeneratingPdf(true); try { await downloadFinalPdfPackage(contract.id, contract.referenceNo); setAttachmentRefresh((value) => value + 1); toast.success("Contract package downloaded."); } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Could not download contract package."); } finally { setGeneratingPdf(false); } }}>{generatingPdf ? <LoaderCircle className="animate-spin" /> : <FileDown />}Generate Final PDF</button>}</div></header>
    <Card><CardHeader><CardTitle>Project and contract information</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-3"><Info label="Department" value={contract.sponsorDepartment?.name ?? "—"} /><Info label="Category" value={contract.contractCategory?.name ?? "—"} /><Info label="Contract amount" value={`${contract.currency?.code ?? ""} ${contract.contractAmount ?? "—"}`.trim()} /><Info label="Budget provision" value={`${contract.currency?.code ?? ""} ${contract.budgetProvision ?? "—"}`.trim()} /><Info label="Estimated cost" value={`${contract.currency?.code ?? ""} ${subtotal}`.trim()} /><Info label="Created by" value={contract.createdBy?.fullName ?? "—"} /><Info label="Last updated" value={new Date(contract.updatedAt).toLocaleString()} /><Info label="Contract Description / Scope of Work" value={contract.scope ?? "—"} wide /><Info label="Business Justification / Procurement Rationale" value={contract.procurementRationale ?? "—"} wide /></CardContent></Card>
    <Card><CardHeader><CardTitle>Contracting vendor</CardTitle></CardHeader><CardContent className="space-y-2"><p className="text-lg font-semibold">{contractingBidder?.companyName || contractingBidder?.vendor?.name || contract.recommendedVendor?.name || "No bidder selected"}</p><Info label="Vendor type" value={contractingBidder?.vendorType?.name ?? contractingBidder?.vendor?.vendorType?.name ?? contract.recommendedVendor?.vendorType?.name ?? "—"} />{contract.recommendedBidder && <p className="text-sm text-muted-foreground">{[contract.recommendedBidder.contactPerson, contract.recommendedBidder.email, contract.recommendedBidder.phone].filter(Boolean).join(" · ") || "No contact details recorded."}</p>}<Info label="Selection rationale" value={contract.selectionRationale ?? "—"} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Bidders, quotations and evaluations</CardTitle></CardHeader><CardContent className="space-y-4">{bidders.length === 0 ? <p className="text-sm text-muted-foreground">No bidders recorded.</p> : bidders.map((bidder) => <div key={bidder.id} className="rounded-lg border p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{bidder.companyName || bidder.vendor?.name}</p><p className="text-sm text-muted-foreground">Vendor type: {bidder.vendorType?.name ?? bidder.vendor?.vendorType?.name ?? "—"}</p><p className="text-sm text-muted-foreground">{[bidder.contactPerson, bidder.email, bidder.phone].filter(Boolean).join(" · ") || "No contact details recorded."}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{bidder.qualifications || "No qualifications recorded."}</p></div><Badge variant={bidder.id === contract.recommendedBidderId ? "default" : "outline"}>{bidder.id === contract.recommendedBidderId ? "Recommended" : "Bidder"}</Badge></div><div className="mt-4 grid gap-4 md:grid-cols-2"><div><h3 className="font-medium">Quotations</h3>{bidder.quotations.length === 0 ? <p className="text-sm text-muted-foreground">No quotations.</p> : bidder.quotations.map((quotation) => <p key={quotation.id} className="text-sm">{quotation.currency?.code ?? "—"} {quotation.quotedAmount}{quotation.notes ? ` — ${quotation.notes}` : ""}</p>)}</div><div><h3 className="font-medium">Evaluations</h3>{(contract.evaluations ?? []).filter((evaluation) => evaluation.bidderId === bidder.id).map((evaluation) => <p key={evaluation.id} className="text-sm">{evaluation.type === "TECHNICAL" ? "Technical" : "Commercial"}: {evaluation.score ?? "—"} — {evaluation.remarks || "No remarks."}</p>)}</div></div></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Budget and cost estimate</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Description</th><th className="py-2">Quantity</th><th className="py-2">Unit cost</th><th className="py-2 text-right">Amount</th></tr></thead><tbody>{lines.map((line) => <tr key={line.id} className="border-b"><td className="py-2">{line.description}</td><td className="py-2">{line.quantity ?? "—"}</td><td className="py-2">{line.unitCost ?? "—"}</td><td className="py-2 text-right">{line.amount}</td></tr>)}</tbody></table></div><div className="mt-4 space-y-1 text-right text-sm"><p>Subtotal: {contract.currency?.code ?? ""} {subtotal}</p><p>Tax: 0.0000 <span className="text-muted-foreground">(tax rules not configured)</span></p><p className="text-base font-semibold">Final total: {contract.currency?.code ?? ""} {subtotal}</p><p className="pt-2">Contract amount: {contract.currency?.code ?? ""} {contract.contractAmount ?? "—"}</p><p>Budget provision: {contract.currency?.code ?? ""} {contract.budgetProvision ?? "—"}</p></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Attachments</CardTitle></CardHeader><CardContent className="space-y-4">{(contract.status === "DRAFT" || contract.status === "RETURNED") && limits && <AttachmentUploader formId={contract.id} limits={limits} onUploaded={() => setAttachmentRefresh((value) => value + 1)} />}<AttachmentList formId={contract.id} refreshKey={attachmentRefresh} canDelete={authUser?.role === "ADMIN" || (authUser?.id === contract.createdById && (contract.status === "DRAFT" || contract.status === "RETURNED"))} /></CardContent></Card>
    {approvalSteps.length > 0 && (
      <Card>
        <CardHeader><CardTitle>Approval Workflow</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {progress && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <p className="font-semibold">{progress.title}</p>
              <p className="mt-1">{progress.message}</p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Approval Level</th>
                  <th className="py-2 pr-4">Approver</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {approvalSteps.map((step) => {
                  const displayStatus = approvalDisplayStatus(step.status);
                  return (
                    <tr key={step.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">Level {step.level}</td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{step.approver?.fullName ?? "Assigned approver"}</p>
                        {step.approver?.email && (
                          <p className="text-xs text-muted-foreground">{step.approver.email}</p>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge variant="outline" className={approvalBadgeClass(displayStatus)}>
                          {displayStatus === "APPROVED" ? "APPROVED ✓" :
                            displayStatus === "PENDING" ? "PENDING ⏳" :
                            displayStatus}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    )}
    <Card><CardHeader><CardTitle>Status history</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>Created: {new Date(contract.createdAt).toLocaleString()}</p>{contract.submittedAt && <p>Submitted: {new Date(contract.submittedAt).toLocaleString()}</p>}{(contract.approvalDecisions ?? []).map((decision) => { const step = (contract.approvalSteps ?? []).find((candidate) => candidate.id === decision.approvalStepId); const approverName = decision.actor?.fullName ?? step?.approver?.fullName ?? "Assigned approver"; return <div key={decision.id} className="rounded border p-2"><p className="font-medium">{decision.decision} — Level {step?.level ?? "—"} — {approverName}</p><p>Comment: {decision.comment || "No comment"}</p><p className="text-xs text-muted-foreground">{new Date(decision.createdAt).toLocaleString()}</p></div>; })}{(contract.approvalDecisions ?? []).length === 0 && <p className="text-muted-foreground">No approval decisions recorded.</p>}</CardContent></Card>
  </div></main>;
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "md:col-span-3" : ""}><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 whitespace-pre-wrap">{value}</p></div>;
}
