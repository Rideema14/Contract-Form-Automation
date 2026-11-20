import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <LockKeyhole className="size-5" />
          </div>
          <CardTitle>Account registration</CardTitle>
          <CardDescription>
            Public registration is disabled. Ask an administrator to create and activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className={buttonVariants({ variant: "outline", className: "w-full" })}>
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
