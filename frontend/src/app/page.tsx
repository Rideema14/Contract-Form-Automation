"use client";

import { useEffect, useState } from "react";
import { Activity, Database, RefreshCw, Server } from "lucide-react";
import { apiRequest } from "@/lib/api-client";

type HealthResponse = {
  status: string;
  message?: string;
  database?: string;
};

type CheckStatus = "checking" | "connected" | "failed";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<CheckStatus>("checking");
  const [dbStatus, setDbStatus] = useState<CheckStatus>("checking");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;

    async function checkHealth() {
      setApiStatus("checking");
      setDbStatus("checking");

      const [apiResult, dbResult] = await Promise.allSettled([
        apiRequest<HealthResponse>("/health"),
        apiRequest<HealthResponse>("/health/db"),
      ]);

      if (!active) return;

      setApiStatus(
        apiResult.status === "fulfilled" && apiResult.value.status === "ok"
          ? "connected"
          : "failed"
      );

      setDbStatus(
        dbResult.status === "fulfilled" &&
          dbResult.value.database === "connected"
          ? "connected"
          : "failed"
      );
    }

    void checkHealth();

    return () => {
      active = false;
    };
  }, [refresh]);

  const allConnected =
    apiStatus === "connected" && dbStatus === "connected";

  function statusText(status: CheckStatus) {
    if (status === "checking") return "Checking...";
    if (status === "connected") return "Connected";
    return "Connection failed";
  }

  function statusColor(status: CheckStatus) {
    if (status === "connected") return "text-green-600";
    if (status === "failed") return "text-red-600";
    return "text-amber-600";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-2xl space-y-8">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Project initialization
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Contract Forms Automation
          </h1>
          <p className="text-muted-foreground">
            Local development environment and service connectivity.
          </p>
        </header>

        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">System health</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Live connection checks
              </p>
            </div>

            <button
              onClick={() => setRefresh((value) => value + 1)}
              disabled={apiStatus === "checking" || dbStatus === "checking"}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>

          <div className="mt-6 divide-y">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Server size={20} className="text-muted-foreground" />
                <div>
                  <p className="font-medium">Express API</p>
                  <p className="text-xs text-muted-foreground">
                    localhost:4000/api/health
                  </p>
                </div>
              </div>
              <span className={`text-sm font-medium ${statusColor(apiStatus)}`}>
                {statusText(apiStatus)}
              </span>
            </div>

            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Database size={20} className="text-muted-foreground" />
                <div>
                  <p className="font-medium">PostgreSQL Database</p>
                  <p className="text-xs text-muted-foreground">
                    localhost:5432
                  </p>
                </div>
              </div>
              <span className={`text-sm font-medium ${statusColor(dbStatus)}`}>
                {statusText(dbStatus)}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-muted p-4">
            <div className="flex items-center gap-2">
              <Activity size={18} />
              <p className="text-sm font-medium">
                {allConnected
                  ? "All services are operational."
                  : "Service connectivity summary"}
              </p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {apiStatus === "checking" || dbStatus === "checking"
                ? "Checking your local services..."
                : allConnected
                  ? "Frontend, backend and database are communicating successfully."
                  : "Start the required services or inspect the backend logs, then refresh."}
            </p>
          </div>
        </section>

        <footer className="text-center text-xs text-muted-foreground">
          Contract Forms Automation · Local Development
        </footer>
      </div>
    </main>
  );
}
