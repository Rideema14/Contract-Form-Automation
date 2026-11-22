"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileText, LoaderCircle, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { getCurrentUser, login } from "@/services/auth";

type FormErrors = {
  email?: string;
  password?: string;
};

function validateForm(email: string, password: string): FormErrors {
  const errors: FormErrors = {};

  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  }

  return errors;
}

function getLoginError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Invalid email or password.";
    return error.message || "Unable to sign in. Please try again.";
  }
  return "Unable to sign in. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void getCurrentUser()
        .then(() => router.replace("/contracts"))
        .catch((error: unknown) => {
          if (!(error instanceof ApiError) || error.status !== 401) {
            setServerError("Unable to check your session. Please try again.");
          }
        })
        .finally(() => setIsCheckingSession(false));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError("");

    const validationErrors = validateForm(email, password);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/contracts");
    } catch (error) {
      setServerError(getLoginError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/90 px-5 py-4 shadow-lg">
          <LoaderCircle className="size-5 animate-spin text-primary" aria-label="Checking session" />
          <span className="text-sm font-medium text-muted-foreground">Checking your secure session...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-8">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/70 bg-card/95 shadow-2xl shadow-slate-950/10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-800 via-slate-800 to-slate-700 p-10 text-white lg:flex">
          <div className="pointer-events-none absolute -right-20 top-10 size-80 rounded-full border-[42px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-28 -left-20 size-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <FileText className="size-6 text-cyan-200" />
            </div>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Contract Forms Automation</p>
            <h1 className="mt-4 max-w-md text-4xl font-bold leading-tight tracking-tight">Clear requests.<br />Confident approvals.</h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-blue-100/80">Prepare contract requests, keep supporting documents together, and follow every decision in one place.</p>
          </div>
          <div className="relative space-y-3">
            {["Save work as a draft", "Route requests to approvers", "Keep documents private"].map((item) => (
              <p key={item} className="flex items-center gap-3 text-sm text-blue-50/90">
                <span className="flex size-6 items-center justify-center rounded-full bg-cyan-300/15 text-cyan-200"><CheckCircle2 className="size-4" /></span>
                {item}
              </p>
            ))}
          </div>
        </section>
        <div className="flex items-center justify-center p-5 sm:p-10">
          <Card className="w-full max-w-md border-0 bg-transparent py-2 shadow-none">
            <CardHeader className="px-1">
              <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary lg:hidden">
                <LockKeyhole className="size-5" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Welcome back</p>
              <CardTitle className="text-3xl font-bold tracking-tight">Sign in</CardTitle>
              <CardDescription className="text-sm">Use your work account to manage contract forms.</CardDescription>
            </CardHeader>
            <CardContent className="px-1">
              <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {serverError && (
              <div
                className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-3.5 text-sm text-destructive"
                role="alert"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <div className="space-y-2.5">
              <Label htmlFor="email" className="text-sm font-semibold">Work email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={email}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (errors.email) {
                    setErrors((current) => ({ ...current, email: undefined }));
                  }
                }}
                disabled={isSubmitting}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-destructive">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (errors.password) {
                    setErrors((current) => ({
                      ...current,
                      password: undefined,
                    }));
                  }
                }}
                disabled={isSubmitting}
              />
              {errors.password && (
                <p id="password-error" className="text-sm text-destructive">
                  {errors.password}
                </p>
              )}
            </div>

            <Button className="h-11 w-full rounded-xl text-sm" type="submit" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="animate-spin" />}
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
            <p className="text-center text-xs leading-5 text-muted-foreground">Need an account? Ask your administrator to create and activate one.</p>
          </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
