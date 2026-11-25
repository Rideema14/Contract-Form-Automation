"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Edit, Eye, LoaderCircle, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import { getContract } from "@/services/contracts";
import type { Contract, CostLine } from "@/types/contracts";
import { ContractEditor } from "@/features/contracts/contract-editor";
import { AttachmentList } from "@/features/attachments/attachment-list";
import { AttachmentUploader } from "@/features/attachments/attachment-uploader";
import {
  downloadFinalPdfPackage,
  generateAndDownloadFinalPdf,
  getAttachmentLimits,
} from "@/features/attachments/attachments-api";
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
  return sumMoney(lines.map((line) => line.amount));
}

function sumMoney(values: string[]) {
  const scaled = values.reduce((sum, value) => {
    const normalized = /^\d+(?:\.\d{1,4})?$/.test(value) ? value : "0";
    const [whole, fraction = ""] = normalized.split(".");
    return sum + BigInt(whole + fraction.padEnd(4, "0"));
  }, BigInt(0));
  const digits = scaled.toString().padStart(5, "0");
  return `${digits.slice(0, -4)}.${digits.slice(-4)}`;
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
  const [generatingFinalPdf, setGeneratingFinalPdf] = useState(false);
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
  const approvalSteps = [...(contract.approvalSteps ?? [])].sort((a, b) => a.level - b.level);
  const isCreator = authUser?.id === contract.createdById;
  const canDeleteAttachments = Boolean(authUser && (
    authUser.role === "ADMIN" ||
    (isCreator && (contract.status === "DRAFT" || contract.status === "RETURNED"))
  ));
  const canGenerateFinalPdf = Boolean(authUser && (
    authUser.role === "ADMIN" ||
    isCreator ||
    approvalSteps.some((step) => step.approverId === authUser.id || step.approver?.id === authUser.id)
  ));
  const subtotal = sumCostLines(lines);
  const approvedSteps = approvalSteps.filter((step) => step.status === "APPROVED").length;
  const approvalPercent = approvalSteps.length ? Math.round((approvedSteps / approvalSteps.length) * 100) : 0;
  return <main className="min-h-screen bg-muted/30 p-4 sm:p-8"><div className="mx-auto flex max-w-6xl flex-col gap-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back</Link>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{contract.title || "Untitled contract"}</h1>
        <p className="text-sm text-muted-foreground">{contract.referenceNo || "No reference number"}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{labels[contract.status]}</Badge>
        {(contract.status === "DRAFT" || contract.status === "RETURNED") && <Link href={`/contracts/${contract.id}?edit=1&return=${encodeURIComponent(backHref)}`} className={buttonVariants()}><Edit />Edit</Link>}
        {contract.status !== "DRAFT" && contract.status !== "RETURNED" && (
          <Link
            href={`/contracts/${contract.id}?view=1&return=${encodeURIComponent(backHref)}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Eye />Open Contract Form
          </Link>
        )}
        {contract.status === "APPROVED" && canGenerateFinalPdf && (
          <button
            type="button"
            className={buttonVariants({ variant: "outline" })}
            disabled={generatingFinalPdf}
            onClick={async () => {
              setGeneratingFinalPdf(true);
              try {
                await generateAndDownloadFinalPdf(contract.id);
                setAttachmentRefresh((value) => value + 1);
                toast.success("Final PDF generated and downloaded.");
              } catch (caught) {
                toast.error(caught instanceof Error ? caught.message : "Could not generate the final PDF.");
              } finally {
                setGeneratingFinalPdf(false);
              }
            }}
          >
            {generatingFinalPdf ? <LoaderCircle className="animate-spin" /> : <FileDown />}
            Generate / Download Final PDF
          </button>
        )}
        {contract.status === "APPROVED" && (authUser?.role === "ADMIN" || authUser?.role === "APPROVER") && (
          <button
            type="button"
            className={buttonVariants({ variant: "outline" })}
            disabled={generatingPdf}
            onClick={async () => {
              setGeneratingPdf(true);
              try {
                await downloadFinalPdfPackage(contract.id, contract.referenceNo);
                setAttachmentRefresh((value) => value + 1);
                toast.success("Contract package downloaded.");
              } catch (caught) {
                toast.error(caught instanceof Error ? caught.message : "Could not download contract package.");
              } finally {
                setGeneratingPdf(false);
              }
            }}
          >
            {generatingPdf ? <LoaderCircle className="animate-spin" /> : <FileDown />}
            Download Full Package
          </button>
        )}
      </div>
    </header>
    <Card><CardHeader><CardTitle>Project and contract information</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-3"><Info label="Department" value={contract.sponsorDepartment?.name ?? "—"} /><Info label="Category" value={contract.contractCategory?.name ?? "—"} /><Info label="Contract amount" value={`${contract.currency?.code ?? ""} ${contract.contractAmount ?? "—"}`} /><Info label="Budget provision" value={`${contract.currency?.code ?? ""} ${contract.budgetProvision ?? "—"}`} /><Info label="Estimated cost" value={`${contract.currency?.code ?? ""} ${subtotal}`} /><Info label="Created by" value={contract.createdBy?.fullName ?? "—"} /><Info label="Last updated" value={new Date(contract.updatedAt).toLocaleString()} /><Info label="Scope" value={contract.scope ?? "—"} wide /><Info label="Procurement rationale" value={contract.procurementRationale ?? "—"} wide /></CardContent></Card>
    <Card><CardHeader><CardTitle>Recommended bidder</CardTitle></CardHeader><CardContent className="space-y-2"><p className="text-lg font-semibold">{contract.recommendedBidder?.companyName || contract.recommendedBidder?.vendor?.name || "No bidder selected"}</p>{contract.recommendedBidder && <p className="text-sm text-muted-foreground">{[contract.recommendedBidder.contactPerson, contract.recommendedBidder.email, contract.recommendedBidder.phone].filter(Boolean).join(" · ") || "No contact details recorded."}</p>}<Info label="Selection rationale" value={contract.selectionRationale ?? "—"} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Bidders, quotations and evaluations</CardTitle></CardHeader><CardContent className="space-y-4">{bidders.length === 0 ? <p className="text-sm text-muted-foreground">No bidders recorded.</p> : bidders.map((bidder) => <div key={bidder.id} className="rounded-lg border p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{bidder.companyName || bidder.vendor?.name}</p><p className="text-sm text-muted-foreground">{[bidder.contactPerson, bidder.email, bidder.phone].filter(Boolean).join(" · ") || "No contact details recorded."}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{bidder.qualifications || "No qualifications recorded."}</p></div><Badge variant={bidder.id === contract.recommendedBidderId ? "default" : "outline"}>{bidder.id === contract.recommendedBidderId ? "Recommended" : "Bidder"}</Badge></div><div className="mt-4 grid gap-4 md:grid-cols-2"><div><h3 className="font-medium">Quotations</h3>{bidder.quotations.length === 0 ? <p className="text-sm text-muted-foreground">No quotations.</p> : bidder.quotations.map((quotation) => <p key={quotation.id} className="text-sm">{quotation.currency?.code ?? "—"} {quotation.quotedAmount}{quotation.notes ? ` — ${quotation.notes}` : ""}</p>)}</div><div><h3 className="font-medium">Evaluations</h3>{(contract.evaluations ?? []).filter((evaluation) => evaluation.bidderId === bidder.id).map((evaluation) => <p key={evaluation.id} className="text-sm">{evaluation.type === "TECHNICAL" ? "Technical" : "Commercial"}: {evaluation.score ?? "—"} — {evaluation.remarks || "No remarks."}</p>)}</div></div></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Budget and cost estimate</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Description</th><th className="py-2">Quantity</th><th className="py-2">Unit cost</th><th className="py-2 text-right">Amount</th></tr></thead><tbody>{lines.map((line) => <tr key={line.id} className="border-b"><td className="py-2">{line.description}</td><td className="py-2">{line.quantity ?? "—"}</td><td className="py-2">{line.unitCost ?? "—"}</td><td className="py-2 text-right">{line.amount}</td></tr>)}</tbody></table></div><div className="mt-4 space-y-1 text-right text-sm"><p>Budget provision: {contract.budgetProvision ?? "—"}</p><p>Subtotal: {subtotal}</p><p>Tax: {contract.taxAmount}</p><p className="text-base font-semibold">Total including tax: {sumMoney([subtotal, contract.taxAmount || "0"])}</p><p className="pt-2">Contract amount: {contract.currency?.code ?? ""} {contract.contractAmount ?? "—"}</p></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Attachments</CardTitle></CardHeader><CardContent className="space-y-4">{(contract.status === "DRAFT" || contract.status === "RETURNED") && limits && <AttachmentUploader formId={contract.id} limits={limits} onUploaded={() => setAttachmentRefresh((value) => value + 1)} />}<AttachmentList formId={contract.id} refreshKey={attachmentRefresh} canDelete={canDeleteAttachments} /></CardContent></Card>
    <Card>
      <CardHeader><CardTitle>Assigned approvers</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Approval progress</span>
            <span>{approvedSteps} of {approvalSteps.length} approved</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${approvalPercent}%` }} />
          </div>
        </div>
        {approvalSteps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approvers assigned.</p>
        ) : approvalSteps.map((step) => (
          <div key={step.id} className="space-y-2 rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">Level {step.level}: {step.approver?.fullName ?? "Assigned approver"}</p>
              <Badge variant="outline">{step.status.replaceAll("_", " ")}</Badge>
            </div>
            {step.actedAt && <p className="text-xs text-muted-foreground">Updated {new Date(step.actedAt).toLocaleString()}</p>}
            {step.decisions?.map((decision) => (
              <p key={decision.id} className="border-t pt-2 text-muted-foreground">
                {decision.decision.replaceAll("_", " ")}{decision.actor?.fullName ? ` by ${decision.actor.fullName}` : ""}
                {decision.comment ? ` — ${decision.comment}` : ""}
              </p>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Status history</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>Created: {new Date(contract.createdAt).toLocaleString()}</p>{contract.submittedAt && <p>Submitted: {new Date(contract.submittedAt).toLocaleString()}</p>}{(contract.approvalDecisions ?? []).map((decision) => <p key={decision.id}>{decision.decision}: {decision.comment || "No comment"} ({new Date(decision.createdAt).toLocaleString()})</p>)}{(contract.approvalDecisions ?? []).length === 0 && <p className="text-muted-foreground">No approval decisions recorded.</p>}</CardContent></Card>
  </div></main>;
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "md:col-span-3" : ""}><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 whitespace-pre-wrap">{value}</p></div>;
}
