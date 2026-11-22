"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { ContractEditor } from "@/features/contracts/contract-editor";

function NewContractForm() {
  const searchParams = useSearchParams();
  const lifecycleKey = searchParams.get("fresh") ?? "direct-new-contract";

  return <ContractEditor key={lifecycleKey} />;
}

export default function NewContractPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[50vh] items-center justify-center">
          <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
        </main>
      }
    >
      <NewContractForm />
    </Suspense>
  );
}
