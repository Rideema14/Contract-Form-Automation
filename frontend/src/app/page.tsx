"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, LoaderCircle, Server } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

type HealthResponse = {
  success: boolean;
  message: string;
};

export default function HomePage() {
  const [status, setStatus] = useState("Checking backend...");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/health`, {
      credentials: "include",
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<HealthResponse>;
      })
      .then((data) => setStatus(data.message))
      .catch((err: Error) => {
        setError(err.message);
        setStatus("Could not reach backend");
      });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border/70 bg-card/95 shadow-2xl shadow-slate-950/10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-800 to-slate-700 p-8 text-white sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full border-[36px] border-white/5" />
          <div className="relative">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <FileText className="size-6 text-cyan-200" />
            </div>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">A clearer way to move work forward</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight">Contract Forms<br />Automation</h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-blue-100/85">Create requests, organize supporting documents, and follow approvals from one workspace.</p>
            <Link href="/login" className={buttonVariants({ className: "mt-8 h-11 rounded-xl bg-white px-5 text-slate-950 hover:bg-blue-50" })}>
              Open workspace <ArrowRight data-icon="inline-end" />
            </Link>
          </div>
        </section>
        <section className="flex flex-col justify-center gap-5 p-7 sm:p-10">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Server className="size-5" /></div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">System status</h2>
            <p className="mt-1 text-sm text-muted-foreground">Checking the application API connection.</p>
          </div>
          <div className={`flex items-center gap-3 rounded-2xl border p-4 ${error ? "border-destructive/20 bg-destructive/5" : "border-emerald-500/20 bg-emerald-500/5"}`} aria-live="polite">
            {error ? <span className="size-2.5 rounded-full bg-destructive" /> : status === "Checking backend..." ? <LoaderCircle className="size-4 animate-spin text-primary" /> : <CheckCircle2 className="size-5 text-emerald-600" />}
            <div>
              <p className="text-sm font-semibold">{error ? "API connection unavailable" : status === "Checking backend..." ? "Connecting..." : "API connection ready"}</p>
              {error && <p className="mt-1 text-xs text-muted-foreground">{status}: {error}</p>}
              {!error && status !== "Checking backend..." && <p className="mt-1 text-xs text-muted-foreground">{status}</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
