"use client";

import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function NewContractLink({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function startNewContract(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    router.push(`/contracts/new?fresh=${window.crypto.randomUUID()}`);
  }

  return (
    <Link href="/contracts/new" className={className} onClick={startNewContract}>
      {children}
    </Link>
  );
}
