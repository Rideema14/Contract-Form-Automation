"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  success: boolean;
  message: string;
};

export default function HomePage() {
  const [status, setStatus] = useState("Checking backend...");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/health`, {
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
    <main className="min-h-screen p-10">
      <h1 className="text-2xl font-bold">Contract Forms Automation</h1>
      <p className="mt-4">Backend status: {status}</p>
      {error && <p className="text-red-600">Error: {error}</p>}
    </main>
  );
}
