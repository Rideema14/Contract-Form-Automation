"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, LoaderCircle, Plus, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/api-client";
import {
  createBidder, createContract, createCostLine, createQuotation, deleteBidder,
  deleteCostLine, deleteQuotation, getContract, getPublishedFormSchema, getReferenceData, saveEvaluations,
  downloadCostEstimateTemplate, importCostEstimate, submitContract, updateBidder, updateContract, updateCostLine, updateQuotation,
} from "@/services/contracts";
import type { Bidder, Contract, ContractDraft, CostLine, DynamicValues, Evaluation, FormSchemaVersion, ReferenceData } from "@/types/contracts";
import { ApproverSelect } from "@/components/approvals/ApproverSelect";
import { API_BASE_URL } from "@/lib/api-client";
import { AttachmentUploader } from "@/features/attachments/attachment-uploader";
import { AttachmentList } from "@/features/attachments/attachment-list";
import { getAttachmentLimits } from "@/features/attachments/attachments-api";
import type { UploadLimits } from "@/features/attachments/types";
import { CompanyDetailsFields, companyContactFields, emptyCompanyDetails, type CompanyDetails } from "@/features/contracts/company-details-fields";
import { defaultDynamicValues, DynamicFormSections, validateDynamicValues } from "@/features/contracts/dynamic-form-sections";

type Props = { contractId?: string; edit?: boolean; readOnly?: boolean; returnTo?: string };
type FormValues = { [K in Exclude<keyof ContractDraft, "dynamicValues">]-?: string };
type CostDraft = { id?: string; description: string; quantity: string; unitCost: string; amount: string };
type QuotationDraft = { amount: string; notes: string };
type EvalDraft = { bidderId: string; type: "TECHNICAL" | "COMMERCIAL"; score: string; remarks: string };

const emptyValues: FormValues = {
  referenceNo: "", title: "", sponsorDepartmentId: "", contractCategoryId: "", scope: "",
  procurementRationale: "", budgetProvision: "", contractAmount: "", taxAmount: "",
  currencyId: "", recommendedVendorId: "", selectionRationale: "",
  recommendedBidderId: "",
};

function errorMessage(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}

function calculatedAmount(quantity: string, unitCost: string) {
  if (!/^\d+(?:\.\d{1,4})?$/.test(quantity) || !/^\d+(?:\.\d{1,4})?$/.test(unitCost)) return "";
  const [quantityWhole, quantityFraction = ""] = quantity.split(".");
  const [unitWhole, unitFraction = ""] = unitCost.split(".");
  const product = BigInt(quantityWhole + quantityFraction) * BigInt(unitWhole + unitFraction);
  const scale = quantityFraction.length + unitFraction.length;
  if (!scale) return product.toString();
  const digits = product.toString().padStart(scale + 1, "0");
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, "");
}

function sumMoney(values: string[]) {
  const scaled = values.reduce((sum, value) => {
    const [whole, fraction = ""] = value.split(".");
    return sum + BigInt(whole + fraction.padEnd(4, "0"));
  }, BigInt(0));
  const digits = scaled.toString().padStart(5, "0");
  return `${digits.slice(0, -4)}.${digits.slice(-4)}`;
}

function costTotal(lines: CostLine[]) {
  return sumMoney(lines.map((line) => line.amount));
}

function totalWithTax(lines: CostLine[], taxAmount: string) {
  if (taxAmount && !/^\d+(?:\.\d{1,4})?$/.test(taxAmount)) return "—";
  return sumMoney([...lines.map((line) => line.amount), taxAmount || "0"]);
}

function contractValues(contract: Contract): FormValues {
  return {
    referenceNo: contract.referenceNo ?? "", title: contract.title ?? "",
    sponsorDepartmentId: contract.sponsorDepartmentId ?? "", contractCategoryId: contract.contractCategoryId ?? "",
    scope: contract.scope ?? "", procurementRationale: contract.procurementRationale ?? "",
    budgetProvision: contract.budgetProvision ?? "", contractAmount: contract.contractAmount ?? "",
    taxAmount: contract.taxAmount ?? "0", currencyId: contract.currencyId ?? "",
    recommendedVendorId: contract.recommendedVendorId ?? "", recommendedBidderId: contract.recommendedBidderId ?? "",
    selectionRationale: contract.selectionRationale ?? "",
  };
}

function validate(
  values: FormValues,
  attempted: boolean,
  bidders: Bidder[],
  costLines: CostLine[],
  evals: EvalDraft[],
  approverIds: string[],
  formSchema: FormSchemaVersion | null,
  dynamicValues: DynamicValues,
) {
  if (!attempted) return {} as Record<string, string>;
  const errors: Record<string, string> = {};
  if (!values.title.trim()) errors.title = "Project name is required.";
  if (!values.sponsorDepartmentId) errors.sponsorDepartmentId = "Sponsor department is required.";
  if (!values.contractCategoryId) errors.contractCategoryId = "Contract category is required.";
  if (!values.scope.trim()) errors.scope = "Scope of work is required.";
  if (!values.procurementRationale.trim()) errors.procurementRationale = "Procurement rationale is required.";
  if (values.budgetProvision && !/^\d+(?:\.\d{1,4})?$/.test(values.budgetProvision)) errors.budgetProvision = "Enter a non-negative amount with up to 4 decimals.";
  if (!/^\d+(?:\.\d{1,4})?$/.test(values.contractAmount)) errors.contractAmount = "Enter a non-negative amount with up to 4 decimals.";
  if (values.taxAmount && !/^\d+(?:\.\d{1,4})?$/.test(values.taxAmount)) errors.taxAmount = "Enter a non-negative amount with up to 4 decimals.";
  if ((values.recommendedVendorId || values.recommendedBidderId) && !values.selectionRationale.trim()) errors.selectionRationale = "Selection rationale is required.";
  if (!bidders.length) errors.bidders = "Bidder Management: add at least one bidder.";
  for (const bidder of bidders) {
    const bidderName = bidder.companyName || bidder.vendor?.name || "Bidder";
    if (!bidder.quotations.length) {
      errors[`quotation-${bidder.id}`] = `Quotations for ${bidderName}: add at least one quotation.`;
    }
    for (const type of ["TECHNICAL", "COMMERCIAL"] as const) {
      const evaluation = evals.find((item) => item.bidderId === bidder.id && item.type === type);
      if (!evaluation?.remarks.trim()) {
        const label = type === "TECHNICAL" ? "Technical" : "Commercial";
        errors[`evaluation-${bidder.id}-${type}`] = `${label} evaluation for ${bidderName}: add remarks.`;
      } else if (evaluation.score && !/^\d+(?:\.\d{1,4})?$/.test(evaluation.score)) {
        const label = type === "TECHNICAL" ? "Technical" : "Commercial";
        errors[`evaluation-${bidder.id}-${type}`] = `${label} evaluation for ${bidderName}: enter a valid non-negative score.`;
      }
    }
  }
  if (!costLines.length) errors.costLines = "Budget and cost information: add at least one cost line.";
  if (!approverIds.length) errors.approverIds = "Approval workflow: assign at least one approver.";
  if (new Set(approverIds).size !== approverIds.length) {
    errors.approverIds = "Approval workflow: remove duplicate approvers.";
  }
  Object.assign(errors, validateDynamicValues(formSchema?.definition, dynamicValues));
  return errors;
}

function evaluationDrafts(items: Evaluation[] = []): EvalDraft[] {
  return items.map((item) => ({
    bidderId: item.bidderId, type: item.type, score: item.score ?? "", remarks: item.remarks ?? "",
  }));
}

function ReadOnlyField({ label, value, wide = false }: { label: string; value: React.ReactNode; wide?: boolean }) {
  const isEmpty = value === null || value === undefined || value === ""
    || (typeof value === "string" && value.trim() === "");
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words">{isEmpty ? "—" : value}</p>
    </div>
  );
}

function ReadOnlyContractForm({
  contract,
  values,
  refs,
  bidders,
  costLines,
  approverIds,
  returnTo,
}: {
  contract: Contract;
  values: FormValues;
  refs: ReferenceData | null;
  bidders: Bidder[];
  costLines: CostLine[];
  approverIds: string[];
  returnTo: string;
}) {
  const recommendedBidder = bidders.find((bidder) => bidder.id === values.recommendedBidderId)
    ?? contract.recommendedBidder;
  const currency = refs?.currencies.find((item) => item.id === values.currencyId)
    ?? contract.currency;

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header>
          <Link href={returnTo} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />Back
          </Link>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{contract.title || "Untitled contract"}</h1>
          <p className="text-sm text-muted-foreground">{contract.referenceNo || "No reference number"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Read-only contract form</p>
        </header>

        <Card>
          <CardHeader><CardTitle>Project Identification</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField label="Project name / contractor / contract title" value={values.title} />
            <ReadOnlyField label="Reference number" value={values.referenceNo} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Project Description</CardTitle></CardHeader>
          <CardContent>
            <ReadOnlyField label="Scope of work" value={values.scope} wide />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contract Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField label="Sponsor department" value={refs?.departments.find((item) => item.id === values.sponsorDepartmentId)?.name} />
            <ReadOnlyField label="Contract category" value={refs?.categories.find((item) => item.id === values.contractCategoryId)?.name} />
            <ReadOnlyField label="Sourcing / procurement rationale" value={values.procurementRationale} wide />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Bidder Management</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {bidders.length === 0 ? <p className="text-sm text-muted-foreground">No bidders recorded.</p> : bidders.map((bidder) => (
              <div key={bidder.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{bidder.companyName || bidder.vendor?.name || "Unnamed bidder"}</p>
                    <p className="text-xs text-muted-foreground">Bidder {bidder.sortOrder + 1}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <ReadOnlyField label="Contact person" value={bidder.contactPerson} />
                  <ReadOnlyField label="Email" value={bidder.email} />
                  <ReadOnlyField label="Phone number" value={bidder.phone} />
                  <ReadOnlyField label="Qualifications / company experience" value={bidder.qualifications} wide />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Financial and Vendor Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField label="Estimated contract amount" value={values.contractAmount} />
            <ReadOnlyField label="Budget provision" value={values.budgetProvision} />
            <ReadOnlyField label="Currency" value={currency ? `${currency.code} - ${currency.name}` : undefined} />
            <ReadOnlyField label="Recommended bidder" value={recommendedBidder?.companyName || recommendedBidder?.vendor?.name || contract.recommendedVendor?.name} />
            <ReadOnlyField label="Selection rationale" value={values.selectionRationale} wide />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quotations</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {bidders.every((bidder) => bidder.quotations.length === 0) ? (
              <p className="text-sm text-muted-foreground">No quotations recorded.</p>
            ) : bidders.flatMap((bidder) => bidder.quotations.map((quotation) => (
              <div key={quotation.id} className="rounded-lg border p-3">
                <p className="font-medium">{bidder.companyName || bidder.vendor?.name || "Unnamed bidder"}</p>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  <ReadOnlyField label="Quoted amount" value={`${quotation.currency?.code ?? "—"} ${quotation.quotedAmount}`} />
                  <ReadOnlyField label="Quotation date" value={quotation.quotationDate ? new Date(quotation.quotationDate).toLocaleDateString() : undefined} />
                  <ReadOnlyField label="Quotation description / notes" value={quotation.notes} />
                </div>
              </div>
            )))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Evaluations</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {bidders.length === 0 ? <p className="text-sm text-muted-foreground">No bidder evaluations recorded.</p> : bidders.map((bidder) => (
              <section key={bidder.id} className="rounded-lg border p-4">
                <h3 className="font-medium">{bidder.companyName || bidder.vendor?.name || "Unnamed bidder"}</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {(["TECHNICAL", "COMMERCIAL"] as const).map((type) => {
                    const evaluation = contract.evaluations?.find((item) => item.bidderId === bidder.id && item.type === type);
                    return (
                      <div key={type} className="rounded border p-3">
                        <h4 className="text-sm font-medium">{type === "TECHNICAL" ? "Technical evaluation" : "Commercial evaluation"}</h4>
                        <div className="mt-2 space-y-3">
                          <ReadOnlyField label="Score" value={evaluation?.score} />
                          <ReadOnlyField label="Evaluation remarks" value={evaluation?.remarks} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Approval Workflow</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Approval sequence for this contract.</p>
            <ApproverSelect inputId={`readonly-approvers-${contract.id}`} value={approverIds} disabled />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Budget and Cost Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {costLines.length === 0 ? <p className="text-sm text-muted-foreground">No cost lines recorded.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead><tr className="border-b text-left"><th className="py-2">Description</th><th className="py-2">Quantity</th><th className="py-2">Unit cost</th><th className="py-2 text-right">Amount</th></tr></thead>
                  <tbody>{costLines.map((line) => <tr key={line.id} className="border-b"><td className="py-2">{line.description || "—"}</td><td className="py-2">{line.quantity ?? "—"}</td><td className="py-2">{line.unitCost ?? "—"}</td><td className="py-2 text-right">{line.amount || "—"}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t pt-3 text-sm">
              <span>Subtotal: {costTotal(costLines)}</span>
              <span>Tax amount: {sumMoney([values.taxAmount || "0"])}</span>
              <strong>Total including tax: {totalWithTax(costLines, values.taxAmount)}</strong>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Supporting Documents</CardTitle></CardHeader>
          <CardContent><AttachmentList formId={contract.id} /></CardContent>
        </Card>

        <DynamicFormSections
          definition={contract.formSchemaVersion?.definition}
          values={contract.dynamicValues ?? {}}
          readOnly
        />
      </div>
    </main>
  );
}

export function ContractEditor({ contractId, edit = true, readOnly = false, returnTo = "/contracts" }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [activeContractId, setActiveContractId] = useState<string | undefined>(contractId);
  const [contract, setContract] = useState<Contract | null>(null);
  const [formSchema, setFormSchema] = useState<FormSchemaVersion | null>(null);
  const [dynamicValues, setDynamicValues] = useState<DynamicValues>({});
  const [refs, setRefs] = useState<ReferenceData | null>(null);
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [newVendor, setNewVendor] = useState("");
  const [companySelection, setCompanySelection] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [newVendorTypeId, setNewVendorTypeId] = useState("");
  const [newCompany, setNewCompany] = useState<CompanyDetails>(emptyCompanyDetails);
  const [quotationDrafts, setQuotationDrafts] = useState<Record<string, QuotationDraft>>({});
  const [costLines, setCostLines] = useState<CostLine[]>([]);
  const [costDraft, setCostDraft] = useState<CostDraft>({ description: "", quantity: "", unitCost: "", amount: "" });
  const [importingCostEstimate, setImportingCostEstimate] = useState(false);
  const costEstimateFileRef = useRef<HTMLInputElement>(null);
  const [evals, setEvals] = useState<EvalDraft[]>([]);
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"All changes saved" | "Saving..." | "Unable to save. Retry.">("All changes saved");
  const [attachmentLimits, setAttachmentLimits] = useState<UploadLimits | null>(null);
  const [attachmentRefresh, setAttachmentRefresh] = useState(0);
  const [attachmentsUploading, setAttachmentsUploading] = useState(false);
  const [preDraftUploadsPending, setPreDraftUploadsPending] = useState(false);
  const preDraftUploadsPendingRef = useRef(false);
  const saveInFlight = useRef<Promise<Contract> | null>(null);
  const autosaveQueued = useRef(false);
  const persistMainRef = useRef<(() => Promise<Contract>) | null>(null);
  const dynamicValuesTouched = useRef(false);
  const autosaveTimer = useRef<number | null>(null);
  const activeContractIdRef = useRef<string | undefined>(contractId);
  const latestValues = useRef(values);
  latestValues.current = values;
  const latestDynamicValues = useRef(dynamicValues);
  latestDynamicValues.current = dynamicValues;
  const errors = useMemo(
    () => validate(values, attempted, bidders, costLines, evals, approverIds, formSchema, dynamicValues),
    [values, attempted, bidders, costLines, evals, approverIds, formSchema, dynamicValues],
  );
  const isEditable = !readOnly && edit && (!contract || contract.status === "DRAFT" || contract.status === "RETURNED");

  useEffect(() => {
    const restoredId = contractId;
    dynamicValuesTouched.current = false;
    autosaveQueued.current = false;
    if (restoredId) {
      activeContractIdRef.current = restoredId;
      setActiveContractId(restoredId);
    }
    Promise.all([
      getReferenceData(),
      restoredId ? getContract(restoredId) : Promise.resolve(null),
      restoredId ? Promise.resolve(null) : getPublishedFormSchema(),
    ])
      .then(([referenceData, loaded, publishedSchema]) => {
        setRefs(referenceData);
        if (loaded) {
          if (!loaded.formSchemaVersion) {
            throw new Error("This contract's original form configuration is unavailable.");
          }
          setContract(loaded);
          setFormSchema(loaded.formSchemaVersion);
          setDynamicValues(loaded.dynamicValues ?? {});
          if (!readOnly) {
            void getAttachmentLimits(loaded.id).then(setAttachmentLimits).catch(() => setAttachmentLimits(null));
          }
          setValues(contractValues(loaded));
          setBidders(loaded.bidders ?? []);
          setCostLines(loaded.costLines ?? []);
          setEvals(evaluationDrafts(loaded.evaluations));
          setApproverIds((loaded.approvalSteps ?? []).map((step) => step.approverId).filter((id): id is string => Boolean(id)).sort((a, b) => {
            const first = loaded.approvalSteps?.find((step) => step.approverId === a);
            const second = loaded.approvalSteps?.find((step) => step.approverId === b);
            return (first?.level ?? 0) - (second?.level ?? 0);
          }));
        } else if (publishedSchema) {
          setFormSchema(publishedSchema);
          setDynamicValues(defaultDynamicValues(publishedSchema.definition));
        }
      })
      .catch((loadError) => setError(errorMessage(loadError, "Unable to load contract data.")))
      .finally(() => setLoading(false));
  }, [contractId, readOnly]);

  function setValue<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function setDynamicValue(fieldId: string, value: string | boolean | string[] | null) {
    dynamicValuesTouched.current = true;
    setDynamicValues((current) => ({ ...current, [fieldId]: value }));
  }

  const navigateToDraft = useCallback((id: string) => {
    router.replace(`/contracts/${id}?edit=1&return=${encodeURIComponent(returnTo)}`);
  }, [returnTo, router]);

  const updatePreDraftUploadsPending = useCallback((pending: boolean) => {
    preDraftUploadsPendingRef.current = pending;
    setPreDraftUploadsPending(pending);
    if (!pending && activeContractIdRef.current) {
      navigateToDraft(activeContractIdRef.current);
    }
  }, [navigateToDraft]);

  const persistMain = useCallback((): Promise<Contract> => {
    if (saveInFlight.current) {
      autosaveQueued.current = true;
      return saveInFlight.current;
    }

    const currentValues = latestValues.current;
    const body: ContractDraft = {
      referenceNo: currentValues.referenceNo.trim() || null,
      title: currentValues.title.trim() || null,
      sponsorDepartmentId: currentValues.sponsorDepartmentId || null,
      contractCategoryId: currentValues.contractCategoryId || null,
      scope: currentValues.scope.trim() || null,
      procurementRationale: currentValues.procurementRationale.trim() || null,
      budgetProvision: currentValues.budgetProvision.trim() || null,
      contractAmount: currentValues.contractAmount.trim() || null,
      taxAmount: currentValues.taxAmount.trim() || "0",
      currencyId: currentValues.currencyId || null,
      recommendedVendorId: currentValues.recommendedVendorId || null,
      selectionRationale: currentValues.selectionRationale.trim() || null,
      recommendedBidderId: currentValues.recommendedBidderId || null,
      dynamicValues: latestDynamicValues.current,
    };
    setSaveState("Saving...");
    const currentContractId = activeContractIdRef.current;
    if (!currentContractId && !formSchema) {
      return Promise.reject(new Error("The published contract form configuration has not loaded."));
    }
    const request: Promise<Contract> = (
      currentContractId
        ? updateContract(currentContractId, body)
        : createContract({ ...body, formSchemaVersionId: formSchema?.id })
    ).then((saved) => {
      if (!currentContractId) {
        activeContractIdRef.current = saved.id;
        setActiveContractId(saved.id);
        if (!preDraftUploadsPendingRef.current) navigateToDraft(saved.id);
      }
      if (saved.status === "DRAFT" || saved.status === "RETURNED") {
        void getAttachmentLimits(saved.id).then(setAttachmentLimits).catch(() => setAttachmentLimits(null));
      }
      setSaveState("All changes saved");
      setContract(saved);
      return saved;
    }).catch((saveError: unknown) => {
      setSaveState("Unable to save. Retry.");
      throw saveError;
    }).finally(() => {
      if (saveInFlight.current === request) {
        saveInFlight.current = null;
        if (autosaveQueued.current) {
          autosaveQueued.current = false;
          window.setTimeout(() => {
            void persistMainRef.current?.().catch(() => setSaveState("Unable to save. Retry."));
          }, 0);
        }
      }
    });

    saveInFlight.current = request;
    return request;
  }, [formSchema, navigateToDraft]);
  persistMainRef.current = persistMain;

  useEffect(() => {
    if (readOnly || loading || !isEditable) return;
    const meaningful = Object.entries(values).some(([, value]) => value.trim() !== "");
    const meaningfulDynamic = Object.values(dynamicValues).some((value) =>
      typeof value === "boolean" ? value : Array.isArray(value) ? value.length > 0 : Boolean(value?.trim()),
    );
    if (!meaningful && !meaningfulDynamic && !dynamicValuesTouched.current) return;

    setSaveState("Saving...");
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void persistMain().catch(() => setSaveState("Unable to save. Retry."));
    }, 900);

    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [values, dynamicValues, loading, isEditable, persistMain, readOnly]);

  useEffect(() => {
    if (readOnly) return;
    function flushPendingChanges() {
      const meaningful = Object.entries(latestValues.current).some(([, value]) => value.trim() !== "");
      const meaningfulDynamic = Object.values(latestDynamicValues.current).some((value) =>
        typeof value === "boolean" ? value : Array.isArray(value) ? value.length > 0 : Boolean(value?.trim()),
      );
      if (!meaningful && !meaningfulDynamic && !dynamicValuesTouched.current) return;
      const body = latestValues.current;
      const payload = {
        referenceNo: body.referenceNo.trim() || null,
        title: body.title.trim() || null,
        sponsorDepartmentId: body.sponsorDepartmentId || null,
        contractCategoryId: body.contractCategoryId || null,
        scope: body.scope.trim() || null,
        procurementRationale: body.procurementRationale.trim() || null,
        budgetProvision: body.budgetProvision.trim() || null,
        contractAmount: body.contractAmount.trim() || null,
        taxAmount: body.taxAmount.trim() || "0",
        currencyId: body.currencyId || null,
        recommendedVendorId: body.recommendedVendorId || null,
        recommendedBidderId: body.recommendedBidderId || null,
        selectionRationale: body.selectionRationale.trim() || null,
        dynamicValues: latestDynamicValues.current,
      };
      const id = activeContractId;
      if (saveInFlight.current) return;
      if (!id && window.location.pathname.endsWith("/contracts/new")) {
        if (!formSchema) return;
        void fetch(`${API_BASE_URL}/forms`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, formSchemaVersionId: formSchema.id }),
          keepalive: true,
        }).catch(() => undefined);
      } else if (id) {
        void fetch(`${API_BASE_URL}/forms/${encodeURIComponent(id)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => undefined);
      }
    }
    window.addEventListener("pagehide", flushPendingChanges);
    return () => window.removeEventListener("pagehide", flushPendingChanges);
  }, [activeContractId, formSchema, readOnly]);

  async function save(submit = false) {
    if (submit && (attachmentsUploading || preDraftUploadsPendingRef.current)) {
      toast.error("Wait for supporting document uploads to finish before submitting.");
      return;
    }
    const submitErrors = submit
      ? validate(values, true, bidders, costLines, evals, approverIds, formSchema, dynamicValues)
      : {};
    setAttempted(submit);
    if (Object.keys(submitErrors).length) {
      const messages = Object.values(submitErrors);
      const visibleMessages = messages.slice(0, 3).join(" ");
      const remainingCount = messages.length - 3;
      toast.error(
        `Please fix ${messages.length} item${messages.length === 1 ? "" : "s"} before submitting. ${visibleMessages}${remainingCount > 0 ? ` And ${remainingCount} more.` : ""}`,
      );
      return;
    }
    setBusy(true);
    try {
      const saved = await persistMain();
      if (evals.length) await saveEvaluations(saved.id, evals.map((item) => ({ ...item, score: item.score || null })));
      if (submit) {
        const submitted = await submitContract(saved.id, approverIds);
        if (submitted.status !== "PENDING_APPROVAL") {
          throw new Error("The server did not confirm that the contract entered pending approval.");
        }
        toast.success("Contract submitted for approval.");
        router.replace(`/contracts/${saved.id}`);
      } else {
        setSaveState("All changes saved");
        toast.success("Draft saved.");
      }
    } catch (saveError) {
      setSaveState("Unable to save. Retry.");
      toast.error(errorMessage(saveError, "Unable to save the contract."));
    } finally {
      setBusy(false);
    }
  }

  async function addBidder() {
    let form = contract;
    if (!form?.id) {
      try {
        form = await persistMain();
      } catch {
        toast.error("Save the draft before adding bidders.");
        return;
      }
    }
    if (!newVendor && companySelection !== "__new__") {
      toast.error("Select an existing company or choose New Company.");
      return;
    }
    if (companySelection === "__new__" && !newCompany.companyName.trim()) {
      toast.error("Enter a company name for the new company.");
      return;
    }
    if (companySelection === "__new__" && !newVendorTypeId) {
      toast.error("Select a vendor type for the new company.");
      return;
    }
    const selectedCompany = refs?.vendors.find((vendor) => vendor.id === companySelection);
    const existingContact = companyContactFields(selectedCompany?.contactDetails);
    try {
      const bidder = await createBidder(form.id, {
        vendorId: companySelection === "__new__" ? null : newVendor || null,
        vendorTypeId: companySelection === "__new__" ? newVendorTypeId : null,
        companyName: companySelection === "__new__" ? newCompany.companyName : undefined,
        contactPerson: companySelection === "__new__" ? newCompany.contactPerson || null : existingContact.contactPerson || null,
        email: companySelection === "__new__" ? newCompany.email || null : existingContact.email || null,
        phone: companySelection === "__new__" ? newCompany.phone || null : existingContact.phone || null,
        qualifications: companySelection === "__new__" ? newCompany.qualifications || null : existingContact.qualifications || null,
      });
      setBidders((current) => [...current, { ...bidder, quotations: bidder.quotations ?? [] }]);
      setNewVendor("");
      setNewVendorTypeId("");
      setCompanySelection("");
      setCompanyQuery("");
      setNewCompany(emptyCompanyDetails);
      toast.success("Bidder added.");
    } catch (createError) {
      toast.error(errorMessage(createError, "Unable to add bidder."));
    }
  }

  async function removeBidder(bidder: Bidder) {
    if (!contract?.id || !window.confirm(`Remove ${bidder.companyName || bidder.vendor?.name} and its quotations?`)) return;
    try {
      if (values.recommendedVendorId === bidder.vendorId || values.recommendedBidderId === bidder.id) {
        await updateContract(contract.id, { recommendedVendorId: null, recommendedBidderId: null, selectionRationale: null });
        setValues((current) => ({ ...current, recommendedVendorId: "", recommendedBidderId: "", selectionRationale: "" }));
      }

      await deleteBidder(contract.id, bidder.id);
      setBidders((current) => current.filter((item) => item.id !== bidder.id));
      setEvals((current) => current.filter((item) => item.bidderId !== bidder.id));
      toast.success("Bidder removed.");
    } catch (removeError) {
      toast.error(errorMessage(removeError, "Unable to remove bidder."));
    }

  }

  async function editBidder(bidder: Bidder) {
    if (!contract?.id) return;
    const companyName = window.prompt("Company name", bidder.companyName);
    if (companyName === null) return;
    const contactPerson = window.prompt("Contact person", bidder.contactPerson ?? "");
    if (contactPerson === null) return;
    const email = window.prompt("Email", bidder.email ?? "");
    if (email === null) return;
    const phone = window.prompt("Phone", bidder.phone ?? "");
    if (phone === null) return;
    const qualifications = window.prompt("Qualifications / company experience", bidder.qualifications ?? "");
    if (qualifications === null) return;
    try {
      const updated = await updateBidder(contract.id, bidder.id, { companyName, contactPerson, email, phone, qualifications });
      setBidders((current) => current.map((item) => item.id === bidder.id ? { ...item, ...updated } : item));
      toast.success("Bidder details updated.");
    } catch (updateError) {
      toast.error(errorMessage(updateError, "Unable to update bidder details."));
    }
  }

  async function addQuotation(bidder: Bidder) {
    const draft = quotationDrafts[bidder.id];
    if (!contract?.id || !draft?.amount.trim() || !/^\d+(?:\.\d{1,4})?$/.test(draft.amount)) {
      toast.error("Enter a valid quoted amount.");
      return;
    }
    try {
      const quotation = await createQuotation(contract.id, bidder.id, {
        quotedAmount: draft.amount, currencyId: values.currencyId || null, notes: draft.notes.trim() || null,
      });
      setBidders((current) => current.map((item) => item.id === bidder.id ? { ...item, quotations: [...item.quotations, quotation] } : item));
      setQuotationDrafts((current) => ({ ...current, [bidder.id]: { amount: "", notes: "" } }));
      toast.success(`Quotation added for ${bidder.companyName || bidder.vendor?.name}.`);
    } catch (createError) {
      toast.error(errorMessage(createError, "Unable to add quotation."));
    }
  }

  async function editQuotation(bidder: Bidder, quotation: Bidder["quotations"][number]) {
    if (!contract?.id) return;
    const amount = window.prompt("Quoted amount", quotation.quotedAmount);
    if (amount === null) return;
    const notes = window.prompt("Quotation notes", quotation.notes ?? "");
    if (notes === null) return;
    try {
      const updated = await updateQuotation(contract.id, bidder.id, quotation.id, { quotedAmount: amount, notes });
      setBidders((current) => current.map((item) => item.id === bidder.id
        ? { ...item, quotations: item.quotations.map((itemQuotation) => itemQuotation.id === quotation.id ? updated : itemQuotation) } : item));
      toast.success("Quotation updated.");
    } catch (updateError) {
      toast.error(errorMessage(updateError, "Unable to update quotation."));
    }
  }

  async function removeQuotation(bidder: Bidder, quotationId: string) {
    if (!contract?.id || !window.confirm("Remove this quotation?")) return;
    try {
      await deleteQuotation(contract.id, bidder.id, quotationId);
      setBidders((current) => current.map((item) => item.id === bidder.id
        ? { ...item, quotations: item.quotations.filter((quotation) => quotation.id !== quotationId) } : item));
    } catch (removeError) {
      toast.error(errorMessage(removeError, "Unable to remove quotation."));
    }
  }

  async function saveCostLine() {
    if (!contract?.id || !costDraft.description.trim() || !costDraft.amount.trim()) {
      toast.error("Description and amount are required.");
      return;
    }
    try {
      const nextSortOrder = costLines.reduce((highest, line) => Math.max(highest, line.sortOrder), -1) + 1;
      const body = { description: costDraft.description.trim(), quantity: costDraft.quantity || null, unitCost: costDraft.unitCost || null, amount: costDraft.amount, sortOrder: costDraft.id ? (costLines.find((line) => line.id === costDraft.id)?.sortOrder ?? nextSortOrder) : nextSortOrder };
      const line = costDraft.id ? await updateCostLine(contract.id, costDraft.id, body) : await createCostLine(contract.id, body);
      setCostLines((current) => costDraft.id ? current.map((item) => item.id === line.id ? line : item) : [...current, line]);
      setCostDraft({ description: "", quantity: "", unitCost: "", amount: "" });
      toast.success("Cost line saved.");
    } catch (lineError) {
      toast.error(errorMessage(lineError, "Unable to save cost line."));
    }
  }

  async function removeCostLine(line: CostLine) {
    if (!contract?.id || !window.confirm("Remove this cost line?")) return;
    try {
      await deleteCostLine(contract.id, line.id);
      setCostLines((current) => current.filter((item) => item.id !== line.id));
    } catch (removeError) {
      toast.error(errorMessage(removeError, "Unable to remove cost line."));
    }
  }

  async function importCostRows(file: File) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Import only supports .xlsx files. Download and use the provided template.");
      return;
    }

    let form = contract;
    if (!form?.id) {
      try {
        form = await persistMain();
      } catch (saveError) {
        toast.error(errorMessage(saveError, "Save the draft before importing cost rows."));
        return;
      }
    }

    if (!form?.id) return;
    setImportingCostEstimate(true);
    try {
      const imported = await importCostEstimate(form.id, file);
      setCostLines((current) => [...current, ...imported]);
      toast.success(`${imported.length} cost row${imported.length === 1 ? "" : "s"} imported.`);
    } catch (importError) {
      toast.error(errorMessage(importError, "Unable to import the Excel cost estimate."));
    } finally {
      setImportingCostEstimate(false);
    }
  }

  function setEvaluation(bidderId: string, type: EvalDraft["type"], patch: Partial<EvalDraft>) {
    setEvals((current) => {
      const existing = current.find((item) => item.bidderId === bidderId && item.type === type);
      if (existing) return current.map((item) => item === existing ? { ...item, ...patch } : item);
      return [...current, { bidderId, type, score: "", remarks: "", ...patch }];
    });
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center"><LoaderCircle className="animate-spin" /></main>;
  if (error) return <main className="mx-auto max-w-3xl p-6 text-destructive">{error}</main>;
  if (readOnly) {
    if (!contract) return <main className="mx-auto max-w-3xl p-6">Contract details are unavailable.</main>;
    return <ReadOnlyContractForm contract={contract} values={values} refs={refs} bidders={bidders} costLines={costLines} approverIds={approverIds} returnTo={returnTo} />;
  }
  if (!isEditable) return <main className="mx-auto max-w-3xl p-6"><p>This contract is no longer editable.</p><Link className="underline" href={`/contracts/${contractId}`}>View contract</Link></main>;

  type FieldKey = Extract<keyof FormValues, string>;
  const input = (key: FieldKey, label: string, type = "text") => (
    <div className="space-y-2"><Label htmlFor={key}>{label}</Label><Input id={key} type={type} value={values[key]} onChange={(event) => setValue(key, event.target.value)} aria-invalid={Boolean(errors[key])} />{errors[key] && <p className="text-sm text-destructive">{errors[key]}</p>}</div>
  );
  const select = (key: FieldKey, label: string, options: { id: string; name: string }[], empty: string) => (
    <div className="space-y-2"><Label htmlFor={key}>{label}</Label><select id={key} className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={values[key]} onChange={(event) => setValue(key, event.target.value)}><option value="">{empty}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>{errors[key] && <p className="text-sm text-destructive">{errors[key]}</p>}</div>
  );

  return <main className="min-h-screen bg-muted/30 p-4 sm:p-8"><div className="mx-auto flex max-w-6xl flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><Link href={returnTo} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back</Link><h1 className="mt-2 text-2xl font-bold">{contract ? "Edit contract" : "New contract"}</h1><p className={saveState === "Unable to save. Retry." ? "mt-1 text-sm text-destructive" : "mt-1 text-sm text-muted-foreground"}>{saveState}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void save()} disabled={busy || attachmentsUploading || saveInFlight.current !== null}><Save />Save draft</Button><Button onClick={() => void save(true)} disabled={busy || attachmentsUploading || preDraftUploadsPending || saveInFlight.current !== null}><Send />Submit</Button></div></div>
    {attempted && Object.keys(errors).length > 0 && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><p className="font-semibold">Complete these items before submitting:</p><ul className="mt-2 list-inside list-disc space-y-1">{Object.entries(errors).map(([field, message]) => <li key={field}>{message}</li>)}</ul></div>}
    <Card className="order-1"><CardHeader><CardTitle>Project identification</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{input("title", "Project name / contractor / contract title")}{input("referenceNo", "Reference number")}</CardContent></Card>
    <Card className="order-2"><CardHeader><CardTitle>Project Description</CardTitle></CardHeader><CardContent><div className="space-y-2"><Label htmlFor="scope">Scope of work</Label><Textarea id="scope" value={values.scope} onChange={(event) => setValue("scope", event.target.value)} aria-invalid={Boolean(errors.scope)} />{errors.scope && <p className="text-sm text-destructive">{errors.scope}</p>}</div></CardContent></Card>
    <Card className="order-3"><CardHeader><CardTitle>Contract information</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{select("sponsorDepartmentId", "Sponsor department", refs?.departments ?? [], "Select department")}{select("contractCategoryId", "Contract category", refs?.categories ?? [], "Select category")}<div className="md:col-span-2 space-y-2"><Label htmlFor="procurementRationale">Sourcing / procurement rationale</Label><Textarea id="procurementRationale" value={values.procurementRationale} onChange={(event) => setValue("procurementRationale", event.target.value)} aria-invalid={Boolean(errors.procurementRationale)} />{errors.procurementRationale && <p className="text-sm text-destructive">{errors.procurementRationale}</p>}</div></CardContent></Card>
    <Card className="order-5"><CardHeader><CardTitle>Financial and vendor information</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{input("budgetProvision", "Budget provision (planned total)", "number")}{input("contractAmount", "Estimated contract amount", "number")}{select("currencyId", "Currency", (refs?.currencies ?? []).map((item) => ({ id: item.id, name: `${item.code} - ${item.name}` })), "Select currency")}<div className="space-y-2"><Label htmlFor="recommendedBidderId">Recommended bidder</Label><select id="recommendedBidderId" className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={values.recommendedBidderId} onChange={(event) => { setValue("recommendedBidderId", event.target.value); setValue("recommendedVendorId", ""); }}><option value="">No recommendation</option>{bidders.map((bidder) => <option key={bidder.id} value={bidder.id}>{bidder.companyName || bidder.vendor?.name}</option>)}</select>{bidders.length === 0 && <p className="text-sm text-muted-foreground">Please add a bidder in Bidder Management before selecting a recommended bidder.</p>}</div><div className="space-y-2"><Label htmlFor="selectionRationale">Selection rationale</Label><Textarea id="selectionRationale" value={values.selectionRationale} onChange={(event) => setValue("selectionRationale", event.target.value)} aria-invalid={Boolean(errors.selectionRationale)} />{errors.selectionRationale && <p className="text-sm text-destructive">{errors.selectionRationale}</p>}</div></CardContent></Card>
    <Card className="order-4">
      <CardHeader><CardTitle>Bidder Management</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="company-selection">Company</Label>
            <Input
              id="company-selection"
              list="company-options"
              value={companyQuery}
              placeholder="Type to search companies..."
              autoComplete="off"
              onChange={(event) => {
                const query = event.target.value;
                setCompanyQuery(query);
                if (query.trim().toLowerCase() === "new company") {
                  setCompanySelection("__new__");
                  setNewVendor("");
                  setNewVendorTypeId(refs?.vendorTypes[0]?.id ?? "");
                  setNewCompany(emptyCompanyDetails);
                  return;
                }
                const match = (refs?.vendors ?? []).find(
                  (vendor) => vendor.name.toLowerCase() === query.trim().toLowerCase(),
                );
                if (match) {
                  setCompanySelection(match.id);
                  setNewVendor(match.id);
                  setNewCompany(emptyCompanyDetails);
                } else {
                  setCompanySelection(query.trim() ? "" : "");
                  setNewVendor("");
                  setNewCompany(emptyCompanyDetails);
                }
              }}
            />
            <datalist id="company-options">
              {(refs?.vendors ?? [])
                .filter((vendor) => !bidders.some((bidder) => bidder.vendorId === vendor.id))
                .map((vendor) => <option key={vendor.id} value={vendor.name} />)}
              <option value="New Company" />
            </datalist>
          </div>
          {companySelection === "__new__" && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <CompanyDetailsFields
                value={newCompany}
                onChange={setNewCompany}
                idPrefix="new-company"
                className="grid gap-3 md:grid-cols-2"
              />
              <div className="space-y-2">
                <Label htmlFor="new-company-vendor-type">Vendor type</Label>
                <select
                  id="new-company-vendor-type"
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                  value={newVendorTypeId}
                  onChange={(event) => setNewVendorTypeId(event.target.value)}
                  required
                >
                  <option value="">Select vendor type</option>
                  {(refs?.vendorTypes ?? []).map((vendorType) => (
                    <option key={vendorType.id} value={vendorType.id}>{vendorType.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {companySelection && companySelection !== "__new__" && (() => {
            const company = refs?.vendors.find((vendor) => vendor.id === companySelection);
            if (!company) return null;
            const details = companyContactFields(company.contactDetails);
            return (
              <div className="rounded-lg border bg-muted/20 p-4" aria-live="polite">
                <p className="font-medium">{company.name}</p>
                <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">Vendor Type</dt><dd>{company.vendorType?.name || "—"}</dd></div>
                  <div><dt className="text-muted-foreground">Contact Person</dt><dd>{details.contactPerson || "—"}</dd></div>
                  <div><dt className="text-muted-foreground">Email</dt><dd>{details.email || "—"}</dd></div>
                  <div><dt className="text-muted-foreground">Phone</dt><dd>{details.phone || "—"}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-muted-foreground">Qualification / Experience</dt><dd className="whitespace-pre-wrap">{details.qualifications || "—"}</dd></div>
                </dl>
              </div>
            );
          })()}
        </div>
        <Button onClick={() => void addBidder()} disabled={!companySelection}><Plus />Add Bidder</Button>
        {bidders.length === 0 && <p className="text-sm text-muted-foreground">No bidders added yet. Save the draft to add a bidder.</p>}
        {bidders.map((bidder) => {
          const draft = quotationDrafts[bidder.id] ?? { amount: "", notes: "" };
          return <div key={bidder.id} className="space-y-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="font-semibold">{bidder.companyName || bidder.vendor?.name}</p><p className="text-xs text-muted-foreground">Bidder {bidder.sortOrder + 1}</p></div>
              <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => void editBidder(bidder)}>Edit details</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => void removeBidder(bidder)}><Trash2 />Remove</Button></div>
            </div>
            <div>
              <h3 className="mb-2 font-medium">Quotations</h3>
              {bidder.quotations.length === 0 ? <p className="text-sm text-muted-foreground">No quotations.</p> : <div className="space-y-2">{bidder.quotations.map((quotation) => <div key={quotation.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted/50 p-2 text-sm"><span>{quotation.currency?.code ?? "—"} {quotation.quotedAmount}{quotation.notes ? ` — ${quotation.notes}` : ""}</span><span className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => void editQuotation(bidder, quotation)}>Edit</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => void removeQuotation(bidder, quotation.id)}>Remove</Button></span></div>)}</div>}
              <div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input type="number" placeholder="Quoted amount" value={draft.amount} onChange={(event) => setQuotationDrafts((current) => ({ ...current, [bidder.id]: { ...draft, amount: event.target.value } }))} /><Input placeholder="Quotation description / notes" value={draft.notes} onChange={(event) => setQuotationDrafts((current) => ({ ...current, [bidder.id]: { ...draft, notes: event.target.value } }))} /><Button variant="outline" onClick={() => void addQuotation(bidder)}>Add quotation</Button></div>
            </div>
            <div>
              <h3 className="mb-2 font-medium">Evaluations</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {(["TECHNICAL", "COMMERCIAL"] as const).map((type) => {
                  const current = evals.find((item) => item.bidderId === bidder.id && item.type === type) ?? { bidderId: bidder.id, type, score: "", remarks: "" };
                  return (
                    <div key={type} className="space-y-2 rounded border p-3">
                      <Label>{type === "TECHNICAL" ? "Technical evaluation" : "Commercial evaluation"}</Label>
                      <Input type="number" placeholder="Score (optional)" value={current.score} onChange={(event) => setEvaluation(bidder.id, type, { score: event.target.value })} />
                      <Textarea placeholder="Evaluation remarks" value={current.remarks} onChange={(event) => setEvaluation(bidder.id, type, { remarks: event.target.value })} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>;
        })}
      </CardContent>
    </Card>
    <Card className="order-7"><CardHeader><CardTitle>Supporting documents</CardTitle></CardHeader><CardContent className="space-y-4"><AttachmentUploader formId={activeContractId} limits={attachmentLimits} onUploaded={() => setAttachmentRefresh((value) => value + 1)} onUploadStateChange={setAttachmentsUploading} onPreDraftPendingChange={updatePreDraftUploadsPending} />{activeContractId && <AttachmentList formId={activeContractId} refreshKey={attachmentRefresh} />}</CardContent></Card>
    <Card className="order-8"><CardHeader><CardTitle>Approval Workflow</CardTitle></CardHeader><CardContent className="space-y-2"><p className="text-sm text-muted-foreground">Select the employees responsible for reviewing and approving this contract. Approvals will follow the sequence specified below.</p><Label htmlFor="contract-approver-search">Select an Approver</Label><ApproverSelect inputId="contract-approver-search" value={approverIds} onChange={setApproverIds} /></CardContent></Card>
    <Card className="order-9">
      <CardHeader><CardTitle>Budget and cost information</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="max-w-xs">{input("taxAmount", "Tax amount (manual entry)", "number")}</div>
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">Import cost rows from Excel</p>
          <p className="text-xs text-muted-foreground">
            Download the template, fill in Description, Quantity, and Unit Cost, then import it. Imported rows are added to existing rows.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || importingCostEstimate}
              onClick={() => void downloadCostEstimateTemplate().catch((downloadError) =>
                toast.error(errorMessage(downloadError, "Unable to download the Excel template.")),
              )}
            >
              <Download />Download Excel template
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || importingCostEstimate}
              onClick={() => costEstimateFileRef.current?.click()}
            >
              {importingCostEstimate ? <LoaderCircle className="animate-spin" /> : null}
              {importingCostEstimate ? "Importing..." : "Import cost rows"}
            </Button>
            <input
              ref={costEstimateFileRef}
              type="file"
              accept=".xlsx"
              className="sr-only"
              aria-label="Excel cost estimate file"
              disabled={busy || importingCostEstimate}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void importCostRows(file);
              }}
            />
          </div>
        </div>
        {costLines.map((line) => (
          <div key={line.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
            <span>{line.description}: {line.quantity} × {line.unitCost} = {line.amount}</span>
            <span>
              <Button size="sm" variant="ghost" onClick={() => setCostDraft({ id: line.id, description: line.description, quantity: line.quantity ?? "", unitCost: line.unitCost ?? "", amount: line.amount })}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void removeCostLine(line)}>Remove</Button>
            </span>
          </div>
        ))}
        <div className="grid gap-2 md:grid-cols-4">
          <Input placeholder="Description" value={costDraft.description} onChange={(event) => setCostDraft({ ...costDraft, description: event.target.value })} />
          <Input placeholder="Quantity" min="0" type="number" value={costDraft.quantity} onChange={(event) => { const quantity = event.target.value; setCostDraft({ ...costDraft, quantity, amount: quantity && costDraft.unitCost ? calculatedAmount(quantity, costDraft.unitCost) : "" }); }} />
          <Input placeholder="Unit cost" min="0" type="number" value={costDraft.unitCost} onChange={(event) => { const unitCost = event.target.value; setCostDraft({ ...costDraft, unitCost, amount: costDraft.quantity && unitCost ? calculatedAmount(costDraft.quantity, unitCost) : "" }); }} />
          <div className="flex gap-2">
            <Input readOnly placeholder="Calculated amount" value={costDraft.amount} />
            <Button type="button" variant="outline" disabled={importingCostEstimate} onClick={() => void saveCostLine()}><Plus /></Button>
          </div>
        </div>
        <div className="flex justify-end gap-6 border-t pt-3 text-sm">
          <span>Subtotal: {costTotal(costLines)}</span>
          <span>Tax amount: {sumMoney([values.taxAmount || "0"])}</span>
          <strong>Total including tax: {totalWithTax(costLines, values.taxAmount)}</strong>
        </div>
      </CardContent>
    </Card>
    <DynamicFormSections
      definition={formSchema?.definition}
      values={dynamicValues}
      errors={errors}
      onChange={setDynamicValue}
    />
  </div></main>;
}
