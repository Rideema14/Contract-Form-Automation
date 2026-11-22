"use client";

import { useEffect, useState } from "react";
import { getReferenceData } from "@/services/contracts";
import type { ReferenceData } from "@/types/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";

export default function AdminReferenceDataPage() {
  const [data, setData] = useState<ReferenceData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      getReferenceData().then(setData).catch((caught) => setError(caught instanceof ApiError ? caught.message : "Could not load reference data."));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="border-b border-border/70 pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Admin workspace</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Reference data</h1>
          <p className="mt-2 text-sm text-muted-foreground">Departments, categories, currencies, and vendors used by contract forms.</p>
        </section>
        {error && <p className="text-destructive">{error}</p>}
        {data && (
          <div className="grid gap-4 lg:grid-cols-2">
            {([
              ["Departments", data.departments.map((item) => item.name)],
              ["Categories", data.categories.map((item) => item.name)],
              ["Currencies", data.currencies.map((item) => `${item.code} — ${item.name}`)],
              ["Vendors", data.vendors.map((item) => item.name)],
            ] as const).map(([title, values]) => (
              <Card key={title}>
                <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
                <CardContent>{values.length ? <ul className="space-y-2 text-sm">{values.map((value) => <li key={value} className="rounded border px-3 py-2">{value}</li>)}</ul> : <p className="text-sm text-muted-foreground">No entries.</p>}</CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
