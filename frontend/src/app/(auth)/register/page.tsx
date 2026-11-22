import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-lg overflow-hidden rounded-3xl text-center">
        <CardHeader>
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-cyan-600 text-primary-foreground shadow-lg shadow-primary/20">
            <LockKeyhole className="size-5" />
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Account access</p>
          <CardTitle className="text-2xl font-bold tracking-tight">Registration is managed by your admin</CardTitle>
          <CardDescription className="mx-auto max-w-sm leading-6">
            Public sign-up is turned off to protect company information. Ask an administrator to create and activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className={buttonVariants({ variant: "default", className: "h-11 w-full rounded-xl" })}>
            <ArrowLeft data-icon="inline-start" />
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
