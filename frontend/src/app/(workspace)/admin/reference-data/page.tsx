"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getReferenceData } from "@/services/contracts";
import type { ReferenceData } from "@/types/contracts";
import { useAuth } from "@/hooks/useAuth";
import { apiPost, apiPatch, apiDelete, ApiError, apiErrorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CompanyDetailsFields, companyContactFields, emptyCompanyDetails, type CompanyDetails } from "@/features/contracts/company-details-fields";

type Category = "departments" | "categories" | "vendor-types" | "currencies" | "vendors";
type RecordItem = { id: string; name: string; code?: string; vendorType?: { id: string; name: string }; contactDetails?: unknown };

function contactDetailsRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value));
}

const categories: { key: Category; label: string }[] = [
  { key: "departments", label: "Departments" },
  { key: "categories", label: "Contract categories" },
  { key: "vendor-types", label: "Vendor types" },
  { key: "currencies", label: "Currencies" },
  { key: "vendors", label: "Vendors" },
];

function itemsFor(data: ReferenceData | null, category: Category): RecordItem[] {
  if (!data) return [];
  if (category === "departments") return data.departments;
  if (category === "categories") return data.categories;
  if (category === "vendor-types") return data.vendorTypes;
  if (category === "currencies") return data.currencies;
  return data.vendors;
}

export default function AdminReferenceDataPage() {
  const router = useRouter();
  const { authUser, loading: authLoading } = useAuth();
  const [data, setData] = useState<ReferenceData | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("departments");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecordItem | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [vendorTypeId, setVendorTypeId] = useState("");
  const [vendorDetails, setVendorDetails] = useState<CompanyDetails>(emptyCompanyDetails);
  const [originalContactDetails, setOriginalContactDetails] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!authLoading && authUser?.role !== "ADMIN") router.replace("/dashboard");
  }, [authLoading, authUser, router]);

  async function load() {
    try {
      setData(await getReferenceData());
    } catch (caught) {
      toast.error(apiErrorMessage(caught, "Could not load reference data."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authUser?.role === "ADMIN") {
      const timeoutId = window.setTimeout(() => void load(), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [authUser]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return itemsFor(data, activeCategory).filter((item) =>
      [item.name, item.code, item.vendorType?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [data, activeCategory, search]);

  function openAdd() {
    setEditing(null);
    setName("");
    setCode("");
    setVendorTypeId(data?.vendorTypes[0]?.id ?? "");
    setVendorDetails(emptyCompanyDetails);
    setOriginalContactDetails({});
    setDialogOpen(true);
  }

  function openEdit(item: RecordItem) {
    setEditing(item);
    setName(item.name);
    setCode(item.code ?? "");
    setVendorTypeId(item.vendorType?.id ?? "");
    setVendorDetails({ companyName: item.name, ...companyContactFields(item.contactDetails) });
    setOriginalContactDetails(contactDetailsRecord(item.contactDetails));
    setDialogOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      let body: unknown;
      if (activeCategory === "currencies") body = { code, name };
      else if (activeCategory === "vendors") {
        const contactDetails = {
          ...originalContactDetails,
          contactPerson: vendorDetails.contactPerson.trim() || null,
          email: vendorDetails.email.trim() || null,
          phone: vendorDetails.phone.trim() || null,
          qualifications: vendorDetails.qualifications.trim() || null,
        };
        body = { name: vendorDetails.companyName, vendorTypeId, contactDetails };
      } else body = { name };

      if (editing) {
        await apiPatch(`/reference-data/${activeCategory}/${editing.id}`, body);
        toast.success("Reference record updated.");
      } else {
        await apiPost(`/reference-data/${activeCategory}`, body);
        toast.success("Reference record added.");
      }
      setDialogOpen(false);
      await load();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? apiErrorMessage(caught, "Could not save reference record.") : caught instanceof Error ? caught.message : "Could not save reference record.");
    }
  }

  async function remove(item: RecordItem) {
    if (!window.confirm(`Delete "${item.code ? `${item.code} - ${item.name}` : item.name}"? This cannot be undone.`)) return;
    try {
      await apiDelete(`/reference-data/${activeCategory}/${item.id}`);
      toast.success("Reference record deleted.");
      await load();
    } catch (caught) {
      toast.error(apiErrorMessage(caught, "Could not delete reference record."));
    }
  }

  if (authLoading || authUser?.role !== "ADMIN") {
    return <main className="min-h-screen bg-muted/30 p-8"><p className="text-muted-foreground">Checking access...</p></main>;
  }

  const activeLabel = categories.find((item) => item.key === activeCategory)?.label;

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reference Data Management</h1>
          <p className="text-muted-foreground">Manage the master values used by Contract Forms.</p>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>{activeLabel}</CardTitle>
            <Button type="button" size="sm" onClick={openAdd}><Plus className="size-4" />Add record</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeCategory} onValueChange={(value) => { setActiveCategory(value as Category); setSearch(""); }}>
              <TabsList className="h-auto w-full justify-start overflow-x-auto">
                {categories.map((category) => <TabsTrigger key={category.key} value={category.key}>{category.label}</TabsTrigger>)}
              </TabsList>
              {categories.map((category) => (
                <TabsContent key={category.key} value={category.key} className="space-y-4">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" placeholder={`Search ${category.label.toLowerCase()}...`} value={search} onChange={(event) => setSearch(event.target.value)} />
                  </div>
                  {loading ? <p className="text-sm text-muted-foreground">Loading records...</p> : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {activeCategory === "currencies" ? <><TableHead>Code</TableHead><TableHead>Name</TableHead></> : activeCategory === "vendors" ? <><TableHead>Name</TableHead><TableHead>Vendor type</TableHead></> : <TableHead>Name</TableHead>}
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleItems.map((item) => (
                          <TableRow key={item.id}>
                            {activeCategory === "currencies" ? <><TableCell className="font-mono">{item.code}</TableCell><TableCell>{item.name}</TableCell></> : activeCategory === "vendors" ? <><TableCell className="font-medium">{item.name}</TableCell><TableCell>{item.vendorType?.name ?? "-"}</TableCell></> : <TableCell className="font-medium">{item.name}</TableCell>}
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(item)}><Pencil className="size-4" />Edit</Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => void remove(item)}><Trash2 className="size-4 text-destructive" />Delete</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {visibleItems.length === 0 && <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No reference records found.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Add"} {activeLabel?.replace(/s$/, "")}</DialogTitle>
            <DialogDescription>Changes are immediately available to Contract Forms.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {activeCategory === "vendors" ? (
              <CompanyDetailsFields
                value={vendorDetails}
                onChange={setVendorDetails}
                idPrefix="vendor"
                className="grid gap-4"
                nameSuggestions={data?.vendors.map((vendor) => ({ id: vendor.id, name: vendor.name })) ?? []}
                onNameChange={(name) => {
                  if (editing) return;
                  const match = data?.vendors.find(
                    (vendor) => vendor.name.toLowerCase() === name.trim().toLowerCase(),
                  );
                  if (match?.vendorType) setVendorTypeId(match.vendorType.id);
                }}
              />
            ) : activeCategory === "currencies" ? (
              <>
                <div className="space-y-1"><Label htmlFor="currency-code">Currency code</Label><Input id="currency-code" value={code} onChange={(event) => setCode(event.target.value)} required maxLength={10} /></div>
                <div className="space-y-1"><Label htmlFor="currency-name">Currency name</Label><Input id="currency-name" value={name} onChange={(event) => setName(event.target.value)} required /></div>
              </>
            ) : (
              <div className="space-y-1"><Label htmlFor="reference-name">Name</Label><Input id="reference-name" value={name} onChange={(event) => setName(event.target.value)} required /></div>
            )}
            {activeCategory === "vendors" && (
              <div className="space-y-2">
                <Label htmlFor="vendor-type">Vendor Type</Label>
                <select
                  id="vendor-type"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={vendorTypeId}
                  onChange={(event) => setVendorTypeId(event.target.value)}
                  required
                >
                  <option value="">Select vendor type</option>
                  {data?.vendorTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                {!data?.vendorTypes.length && (
                  <p className="text-sm text-muted-foreground">Add a vendor type in the Vendor types tab before creating a vendor.</p>
                )}
                </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? "Save changes" : "Add record"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
