import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: "Contract Forms Automation",
  description: "Contract form creation, approval workflow and PDF generation",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
