"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Plus, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  createBidder, createContract, createCostLine, createQuotation, deleteBidder,
  deleteCostLine, deleteQuotation, getContract, getReferenceData, saveEvaluations,
  submitContract, updateBidder, updateContract, updateCostLine, updateQuotation,
} from "@/services/contracts";
import type { Bidder, Contract, ContractDraft, CostLine, Evaluation, ReferenceData } from "@/types/contracts";

type Props = { contractId?: string; edit?: boolean };
type FormValues = { [K in keyof ContractDraft]-?: string };
type CostDraft = { id?: string; description: string; quantity: string; unitCost: string; amount: string };
type QuotationDraft = { amount: string; notes: string };
type EvalDraft = { bidderId: string; type: "TECHNICAL" | "COMMERCIAL"; score: string; remarks: string };

const emptyValues: FormValues = {
  referenceNo: "", title: "", sponsorDepartmentId: "", contractCategoryId: "", scope: "",
  procurementRationale: "", contractAmount: "", currencyId: "", recommendedVendorId: "", selectionRationale: "",
  recommendedBidderId: "",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
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

function costTotal(lines: CostLine[]) {
  const scaled = lines.reduce((sum, line) => {
    const [whole, fraction = ""] = line.amount.split(".");
    return sum + BigInt(whole + fraction.padEnd(4, "0"));
  }, BigInt(0));
  const digits = scaled.toString().padStart(5, "0");
  return `${digits.slice(0, -4)}.${digits.slice(-4)}`;
}

function contractValues(contract: Contract): FormValues {
  return {
    referenceNo: contract.referenceNo ?? "", title: contract.title ?? "",
    sponsorDepartmentId: contract.sponsorDepartmentId ?? "", contractCategoryId: contract.contractCategoryId ?? "",
    scope: contract.scope ?? "", procurementRationale: contract.procurementRationale ?? "",
    contractAmount: contract.contractAmount ?? "", currencyId: contract.currencyId ?? "",
    recommendedVendorId: contract.recommendedVendorId ?? "", recommendedBidderId: contract.recommendedBidderId ?? "",
    selectionRationale: contract.selectionRationale ?? "",
  };
}

function validate(values: FormValues, attempted: boolean) {
  if (!attempted) return {} as Record<string, string>;
  const errors: Record<string, string> = {};
  if (!values.title.trim()) errors.title = "Project name is required.";
  if (!values.sponsorDepartmentId) errors.sponsorDepartmentId = "Sponsor department is required.";
  if (!values.contractCategoryId) errors.contractCategoryId = "Contract category is required.";
  if (!values.scope.trim()) errors.scope = "Scope of work is required.";
  if (!values.procurementRationale.trim()) errors.procurementRationale = "Procurement rationale is required.";
  if (!/^\d+(?:\.\d{1,4})?$/.test(values.contractAmount)) errors.contractAmount = "Enter a non-negative amount with up to 4 decimals.";
  if ((values.recommendedVendorId || values.recommendedBidderId) && !values.selectionRationale.trim()) errors.selectionRationale = "Selection rationale is required.";
  return errors;
}

function evaluationDrafts(items: Evaluation[] = []): EvalDraft[] {
  return items.map((item) => ({
    bidderId: item.bidderId, type: item.type, score: item.score ?? "", remarks: item.remarks ?? "",
  }));
}

export function ContractEditor({ contractId, edit = true }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [contract, setContract] = useState<Contract | null>(null);
  const [refs, setRefs] = useState<ReferenceData | null>(null);
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [newVendor, setNewVendor] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [newCompany, setNewCompany] = useState({ companyName: "", contactPerson: "", email: "", phone: "", qualifications: "" });
  const [quotationDrafts, setQuotationDrafts] = useState<Record<string, QuotationDraft>>({});
  const [costLines, setCostLines] = useState<CostLine[]>([]);
  const [costDraft, setCostDraft] = useState<CostDraft>({ description: "", quantity: "", unitCost: "", amount: "" });
  const [evals, setEvals] = useState<EvalDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  const errors = useMemo(() => validate(values, attempted), [values, attempted]);
  const isEditable = edit && (!contract || contract.status === "DRAFT" || contract.status === "RETURNED");

  useEffect(() => {
    Promise.all([getReferenceData(), contractId ? getContract(contractId) : Promise.resolve(null)])
      .then(([referenceData, loaded]) => {
        setRefs(referenceData);
        if (loaded) {
          setContract(loaded);
          setValues(contractValues(loaded));
          setBidders(loaded.bidders ?? []);
          setCostLines(loaded.costLines ?? []);
          setEvals(evaluationDrafts(loaded.evaluations));
        }
      })
      .catch((loadError) => setError(errorMessage(loadError, "Unable to load contract data.")))
      .finally(() => setLoading(false));
  }, [contractId]);

  function setValue<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function persistMain() {
    const body: ContractDraft = {
      referenceNo: values.referenceNo.trim() || null, title: values.title.trim() || null,
      sponsorDepartmentId: values.sponsorDepartmentId || null, contractCategoryId: values.contractCategoryId || null,
      scope: values.scope.trim() || null, procurementRationale: values.procurementRationale.trim() || null,
      contractAmount: values.contractAmount.trim() || null, currencyId: values.currencyId || null,
      recommendedVendorId: values.recommendedVendorId || null, selectionRationale: values.selectionRationale.trim() || null,
      recommendedBidderId: values.recommendedBidderId || null,
    };
    const saved = contractId ? await updateContract(contractId, body) : await createContract(body);
    setContract(saved);
    return saved;
  }

  async function save(submit = false) {
    setAttempted(submit);
    if (submit && Object.keys(errors).length) {
      toast.error("Complete the required contract fields.");
      return;
    }
    setBusy(true);
    try {
      const saved = await persistMain();
      if (evals.length) await saveEvaluations(saved.id, evals.map((item) => ({ ...item, score: item.score || null })));
      if (submit) {
        if (!bidders.length) throw new Error("Add at least one bidder before submitting.");
        if (!costLines.length) throw new Error("Add at least one cost line before submitting.");
        if (evals.length < bidders.length * 2 || evals.some((item) => !item.remarks.trim())) {
          throw new Error("Add technical and commercial remarks for every bidder before submitting.");
        }
        await submitContract(saved.id);
        toast.success("Contract submitted for approval.");
        router.push(`/contracts/${saved.id}`);
      } else {
        toast.success("Draft saved.");
        if (!contractId) window.history.replaceState(null, "", `/contracts/${saved.id}?edit=1`);
      }
    } catch (saveError) {
      toast.error(errorMessage(saveError, "Unable to save the contract."));
    } finally {
      setBusy(false);
    }
  }

  async function addBidder() {
    if (!contract?.id) {
      toast.error("Save the draft before adding bidders.");
      return;
    }
    if (!newVendor && !newCompany.companyName.trim()) {
      toast.error("Enter a company name for the new company.");
      return;
    }
    try {
      const bidder = await createBidder(contract.id, {
        vendorId: newVendor || null,
        companyName: newCompany.companyName || undefined,
        contactPerson: newCompany.contactPerson || null,
        email: newCompany.email || null,
        phone: newCompany.phone || null,
        qualifications: newCompany.qualifications || null,
        sortOrder: bidders.length,
      });
      setBidders((current) => [...current, { ...bidder, quotations: bidder.quotations ?? [] }]);
      setNewVendor("");
      setNewCompany({ companyName: "", contactPerson: "", email: "", phone: "", qualifications: "" });
      toast.success("Bidder added.");
    } catch (createError) {
      toast.error(errorMessage(createError, "Unable to add bidder."));
    }
  }

  async function removeBidder(bidder: Bidder) {
    if (!contract?.id || !window.confirm(`Remove ${bidder.companyName || bidder.vendor?.name} and its quotations?`)) return;
    try {
      if (values.recommendedVendorId === bidder.vendorId) {
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
      const body = { description: costDraft.description.trim(), quantity: costDraft.quantity || null, unitCost: costDraft.unitCost || null, amount: costDraft.amount, sortOrder: costDraft.id ? (costLines.find((line) => line.id === costDraft.id)?.sortOrder ?? costLines.length) : costLines.length };
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

  function setEvaluation(bidderId: string, type: EvalDraft["type"], patch: Partial<EvalDraft>) {
    setEvals((current) => {
      const existing = current.find((item) => item.bidderId === bidderId && item.type === type);
      if (existing) return current.map((item) => item === existing ? { ...item, ...patch } : item);
      return [...current, { bidderId, type, score: "", remarks: "", ...patch }];
    });
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center"><LoaderCircle className="animate-spin" /></main>;
  if (error) return <main className="mx-auto max-w-3xl p-6 text-destructive">{error}</main>;
  if (!isEditable) return <main className="mx-auto max-w-3xl p-6"><p>This contract is no longer editable.</p><Link className="underline" href={`/contracts/${contractId}`}>View contract</Link></main>;

  type FieldKey = Extract<keyof FormValues, string>;
  const input = (key: FieldKey, label: string, type = "text") => (
    <div className="space-y-2"><Label htmlFor={key}>{label}</Label><Input id={key} type={type} value={values[key]} onChange={(event) => setValue(key, event.target.value)} aria-invalid={Boolean(errors[key])} />{errors[key] && <p className="text-sm text-destructive">{errors[key]}</p>}</div>
  );
  const select = (key: FieldKey, label: string, options: { id: string; name: string }[], empty: string) => (
    <div className="space-y-2"><Label htmlFor={key}>{label}</Label><select id={key} className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={values[key]} onChange={(event) => setValue(key, event.target.value)}><option value="">{empty}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>{errors[key] && <p className="text-sm text-destructive">{errors[key]}</p>}</div>
  );

  return <main className="min-h-screen bg-muted/30 p-4 sm:p-8"><div className="mx-auto flex max-w-6xl flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><Link href="/contracts" className="text-sm text-muted-foreground"><ArrowLeft className="mr-1 inline size-4" />Back to register</Link><h1 className="mt-2 text-2xl font-bold">{contract ? "Edit contract" : "New contract"}</h1></div><div className="flex gap-2"><Button variant="outline" onClick={() => void save()} disabled={busy}><Save />Save draft</Button><Button onClick={() => void save(true)} disabled={busy}><Send />Submit</Button></div></div>
    <Card><CardHeader><CardTitle>Project identification</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{input("title", "Project name / contract title")}{input("referenceNo", "Reference number")}<div className="md:col-span-2 space-y-2"><Label htmlFor="scope">Project description / scope of work</Label><Textarea id="scope" value={values.scope} onChange={(event) => setValue("scope", event.target.value)} aria-invalid={Boolean(errors.scope)} />{errors.scope && <p className="text-sm text-destructive">{errors.scope}</p>}</div></CardContent></Card>
    <Card><CardHeader><CardTitle>Contract information</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{select("sponsorDepartmentId", "Sponsor department", refs?.departments ?? [], "Select department")}{select("contractCategoryId", "Contract category", refs?.categories ?? [], "Select category")}<div className="md:col-span-2 space-y-2"><Label htmlFor="procurementRationale">Sourcing / procurement rationale</Label><Textarea id="procurementRationale" value={values.procurementRationale} onChange={(event) => setValue("procurementRationale", event.target.value)} aria-invalid={Boolean(errors.procurementRationale)} />{errors.procurementRationale && <p className="text-sm text-destructive">{errors.procurementRationale}</p>}</div></CardContent></Card>
    <Card><CardHeader><CardTitle>Financial and vendor information</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{input("contractAmount", "Estimated contract amount", "number")}{select("currencyId", "Currency", (refs?.currencies ?? []).map((item) => ({ id: item.id, name: `${item.code} - ${item.name}` })), "Select currency")}<div className="space-y-2"><Label htmlFor="recommendedBidderId">Recommended bidder</Label><select id="recommendedBidderId" className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={values.recommendedBidderId} onChange={(event) => { setValue("recommendedBidderId", event.target.value); setValue("recommendedVendorId", ""); }}><option value="">No recommendation</option>{bidders.map((bidder) => <option key={bidder.id} value={bidder.id}>{bidder.companyName || bidder.vendor?.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="selectionRationale">Selection rationale</Label><Textarea id="selectionRationale" value={values.selectionRationale} onChange={(event) => setValue("selectionRationale", event.target.value)} aria-invalid={Boolean(errors.selectionRationale)} />{errors.selectionRationale && <p className="text-sm text-destructive">{errors.selectionRationale}</p>}</div></CardContent></Card>
    <Card><CardHeader><CardTitle>Bidder Management</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 md:grid-cols-2"><Input placeholder="Search existing vendors" value={vendorSearch} onChange={(event) => setVendorSearch(event.target.value)} /><select className="h-9 rounded-lg border bg-background px-2 text-sm" value={newVendor} onChange={(event) => setNewVendor(event.target.value)}><option value="">Add New Company</option>{(refs?.vendors ?? []).filter((vendor) => !bidders.some((bidder) => bidder.vendorId === vendor.id) && vendor.name.toLowerCase().includes(vendorSearch.toLowerCase())).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select><Input placeholder="Company name (required for new company)" value={newCompany.companyName} onChange={(event) => setNewCompany({ ...newCompany, companyName: event.target.value })} /><Input placeholder="Contact person" value={newCompany.contactPerson} onChange={(event) => setNewCompany({ ...newCompany, contactPerson: event.target.value })} /><Input placeholder="Email" type="email" value={newCompany.email} onChange={(event) => setNewCompany({ ...newCompany, email: event.target.value })} /><Input placeholder="Phone" value={newCompany.phone} onChange={(event) => setNewCompany({ ...newCompany, phone: event.target.value })} /><Input placeholder="Qualifications / experience" value={newCompany.qualifications} onChange={(event) => setNewCompany({ ...newCompany, qualifications: event.target.value })} /></div><Button onClick={() => void addBidder()}><Plus />Add Bidder</Button>{bidders.length === 0 &&     <p className="text-sm text-muted-foreground">No bidders added yet. Save the draft to add a bidder.</p>}{bidders.map((bidder) => { const draft = quotationDrafts[bidder.id] ?? { amount: "", notes: "" }; return <div key={bidder.id} className="space-y-4 rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{bidder.companyName || bidder.vendor?.name}</p><p className="text-xs text-muted-foreground">Bidder {bidder.sortOrder + 1}</p></div><div><Button size="sm" variant="outline" onClick={() => void editBidder(bidder)}>Edit details</Button><Button variant="ghost" className="text-destructive" onClick={() => void removeBidder(bidder)}><Trash2 />Remove</Button></div></div><div><h3 className="mb-2 font-medium">Quotations</h3>{bidder.quotations.length === 0 ? <p className="text-sm text-muted-foreground">No quotations.</p> : <div className="space-y-2">{bidder.quotations.map((quotation) => <div key={quotation.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted/50 p-2 text-sm"><span>{quotation.currency?.code ?? "—"} {quotation.quotedAmount}{quotation.notes ? ` — ${quotation.notes}` : ""}</span><span className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => void editQuotation(bidder, quotation)}>Edit</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => void removeQuotation(bidder, quotation.id)}>Remove</Button></span></div>)}</div>}<div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input type="number" placeholder="Quoted amount" value={draft.amount} onChange={(event) => setQuotationDrafts((current) => ({ ...current, [bidder.id]: { ...draft, amount: event.target.value } }))} /><Input placeholder="Quotation description / notes" value={draft.notes} onChange={(event) => setQuotationDrafts((current) => ({ ...current, [bidder.id]: { ...draft, notes: event.target.value } }))} /><Button variant="outline" onClick={() => void addQuotation(bidder)}>Add quotation</Button></div></div><div><h3 className="mb-2 font-medium">Evaluations</h3><div className="grid gap-3 md:grid-cols-2">{(["TECHNICAL", "COMMERCIAL"] as const).map((type) => { const current = evals.find((item) => item.bidderId === bidder.id && item.type === type) ?? { bidderId: bidder.id, type, score: "", remarks: "" }; return <div key={type} className="space-y-2 rounded border p-3"><Label>{type === "TECHNICAL" ? "Technical evaluation" : "Commercial evaluation"}</Label><Input type="number" placeholder="Score (optional)" value={current.score} onChange={(event) => setEvaluation(bidder.id, type, { score: event.target.value })} /><Textarea placeholder="Evaluation remarks" value={current.remarks} onChange={(event) => setEvaluation(bidder.id, type, { remarks: event.target.value })} /></div>; })}</div></div></div>; })}</CardContent></Card>
    <Card><CardHeader><CardTitle>Budget and cost information</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Tax is not configured; tax is 0.00.</p>{costLines.map((line) => <div key={line.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm"><span>{line.description}: {line.quantity} × {line.unitCost} = {line.amount}</span><span><Button size="sm" variant="ghost" onClick={() => setCostDraft({ id: line.id, description: line.description, quantity: line.quantity ?? "", unitCost: line.unitCost ?? "", amount: line.amount })}>Edit</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => void removeCostLine(line)}>Remove</Button></span></div>)}<div className="grid gap-2 md:grid-cols-4"><Input placeholder="Description" value={costDraft.description} onChange={(event) => setCostDraft({ ...costDraft, description: event.target.value })} /><Input placeholder="Quantity" min="0" type="number" value={costDraft.quantity} onChange={(event) => { const quantity = event.target.value; setCostDraft({ ...costDraft, quantity, amount: quantity && costDraft.unitCost ? calculatedAmount(quantity, costDraft.unitCost) : "" }); }} /><Input placeholder="Unit cost" min="0" type="number" value={costDraft.unitCost} onChange={(event) => { const unitCost = event.target.value; setCostDraft({ ...costDraft, unitCost, amount: costDraft.quantity && unitCost ? calculatedAmount(costDraft.quantity, unitCost) : "" }); }} /><div className="flex gap-2"><Input readOnly placeholder="Calculated amount" value={costDraft.amount} /><Button variant="outline" onClick={() => void saveCostLine()}><Plus /></Button></div></div><div className="flex justify-end gap-6 border-t pt-3 text-sm"><span>Subtotal: {costTotal(costLines)}</span><span>Tax: 0.0000</span><strong>Total: {costTotal(costLines)}</strong></div></CardContent></Card>
  </div></main>;
}
