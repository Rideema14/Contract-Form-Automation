"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { getCurrentUser } from "@/services/auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    getCurrentUser()
      .then(() => router.replace("/dashboard"))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
        } else {
          router.replace("/login");
        }
      });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center" aria-label="Redirecting">
      <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
    </main>
  );
}
