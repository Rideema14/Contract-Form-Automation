
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FileText, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { getCurrentUser, login } from "@/services/auth";

type FormErrors = {
  email?: string;
  password?: string;
};

type DemoAccount = {
  role: "ADMIN" | "APPROVER" | "SUBMITTER";
  description: string;
  email: string;
  password: string;
};

const demoAccounts: DemoAccount[] = [
  {
    role: "ADMIN",
    description: "Manage users, reference data & audit history",
    email: process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL || "admin@example.com",
    password: process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD || "admin123@#",
  },
  {
    role: "APPROVER",
    description: "Review and decide on assigned contracts",
    email: process.env.NEXT_PUBLIC_DEMO_APPROVER_EMAIL || "approver@example.com",
    password: process.env.NEXT_PUBLIC_DEMO_APPROVER_PASSWORD || "approver123@#",
  },
  {
    role: "SUBMITTER",
    description: "Create contracts, upload files & track status",
    email: process.env.NEXT_PUBLIC_DEMO_SUBMITTER_EMAIL || "submitter@example.com",
    password: process.env.NEXT_PUBLIC_DEMO_SUBMITTER_PASSWORD || "user123@#",
  },
];

const demoLoginsEnabled = true;

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
        .then(() => router.replace("/dashboard"))
        .catch((error: unknown) => {
          if (!(error instanceof ApiError) || error.status !== 401) {
            setServerError(
              "Unable to check your session. Please try again."
            );
          }
        })
        .finally(() => setIsCheckingSession(false));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [router]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setServerError("");

    const validationErrors = validateForm(email, password);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      router.replace("/dashboard");
    } catch (error) {
      setServerError(getLoginError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function fillDemoAccount(account: DemoAccount) {
    setEmail(account.email);
    setPassword(account.password);
    setErrors({});
    setServerError("");
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <LoaderCircle
          className="size-6 animate-spin text-muted-foreground"
          aria-label="Checking session"
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen bg-background text-foreground">

      {/* Left branding panel — black & white enterprise panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground">

        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-primary-foreground/20 bg-primary-foreground/10">
            <FileText className="size-5 text-primary-foreground" />
          </div>

          <span className="text-lg font-semibold tracking-tight">
            Contract Forms
          </span>
        </div>

        <div className="space-y-6">

          <div className="space-y-3">
            <div className="inline-block rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-primary-foreground/80">
              Procurement &amp; Governance
            </div>

            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Contract Forms
              <br />
              Automation
            </h1>

            <p className="max-w-sm text-base leading-relaxed text-primary-foreground/70">
              Create, review, and approve contract forms with structured
              multi-level sign-off — from first draft to final PDF.
            </p>
          </div>

          {/* Three functional demo account cards */}
          <div className="grid grid-cols-3 gap-4 pt-4">

            {demoAccounts.map((account) => {
              const configured =
                demoLoginsEnabled &&
                Boolean(
                  account.email.trim() && account.password
                );

              return (
                <Button
                  key={account.role}
                  type="button"
                  variant="outline"
                  disabled={!configured || isSubmitting}
                  onClick={() => fillDemoAccount(account)}
                  aria-label={`Fill ${account.role.toLowerCase()} demo credentials`}
                  className="h-auto min-h-[100px] flex-col items-start justify-center gap-2 whitespace-normal rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 p-4 text-left text-primary-foreground hover:border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground disabled:opacity-50"
                >
                  <span className="text-sm font-semibold">
                    {account.role === "ADMIN"
                      ? "Admins"
                      : account.role === "APPROVER"
                        ? "Approvers"
                        : "Submitters"}
                  </span>

                  <span className="text-xs font-normal text-primary-foreground/65">
                    {account.description}
                  </span>

                  <span className="text-[11px] font-medium text-primary-foreground/70">
                    {configured
                      ? "Click to fill →"
                      : "Unavailable"}
                  </span>
                </Button>
              );
            })}

          </div>

          <p className="text-xs text-primary-foreground/50">
            Demo credentials are public to visitors. Use disposable
            accounts only; never configure real or production accounts here.
          </p>

        </div>

        <p className="text-xs text-primary-foreground/50">
          &copy; {new Date().getFullYear()} Contract Forms Automation.
        </p>

      </div>

      {/* Right login panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-muted/30 p-6 lg:p-12">

        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileText className="size-4" />
            </div>

            <span className="text-base font-semibold tracking-tight text-foreground">
              Contract Forms
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card p-8 text-card-foreground shadow-sm">

            <div className="mb-7">
              <h2 className="text-2xl font-bold tracking-tight">
                Welcome back
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Sign in to your account to continue
              </p>
            </div>

            <form
              className="space-y-5"
              onSubmit={handleSubmit}
              noValidate
            >

              {serverError && (
                <div
                  className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email address
                </Label>

                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={
                    errors.email ? "email-error" : undefined
                  }
                  className="h-10"
                  onChange={(event) => {
                    setEmail(event.target.value);

                    if (errors.email) {
                      setErrors((c) => ({
                        ...c,
                        email: undefined,
                      }));
                    }
                  }}
                  disabled={isSubmitting}
                />

                {errors.email && (
                  <p
                    id="email-error"
                    className="text-xs text-destructive"
                  >
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>

                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                  className="h-10"
                  onChange={(event) => {
                    setPassword(event.target.value);

                    if (errors.password) {
                      setErrors((c) => ({
                        ...c,
                        password: undefined,
                      }));
                    }
                  }}
                  disabled={isSubmitting}
                />

                {errors.password && (
                  <p
                    id="password-error"
                    className="text-xs text-destructive"
                  >
                    {errors.password}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-10 w-full font-semibold"
              >
                {isSubmitting && (
                  <LoaderCircle className="size-4 animate-spin" />
                )}

                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>

            </form>

            {/* Demo accounts remain available on mobile only */}
            <section
              className="mt-6 border-t pt-5 lg:hidden"
              aria-labelledby="demo-login-title"
            >
              <h3
                id="demo-login-title"
                className="text-sm font-semibold"
              >
                Explore with a demo role
              </h3>

              <p className="mt-1 text-xs text-muted-foreground">
                Select a role to fill its demo sign-in details.
              </p>

              <div className="mt-3 grid gap-2">
                {demoAccounts.map((account) => {
                  const configured =
                    demoLoginsEnabled &&
                    Boolean(
                      account.email.trim() && account.password
                    );

                  return (
                    <Button
                      key={account.role}
                      type="button"
                      variant="outline"
                      className="h-auto w-full justify-start gap-3 p-3 text-left"
                      disabled={!configured || isSubmitting}
                      aria-label={`Fill ${account.role.toLowerCase()} demo credentials`}
                      onClick={() => fillDemoAccount(account)}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {account.role.slice(0, 3)}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {account.role}
                        </span>

                        <span className="block truncate text-xs text-muted-foreground">
                          {configured
                            ? account.email
                            : "Demo account not configured"}
                        </span>
                      </span>

                      <span className="text-xs text-muted-foreground">
                        {configured ? "Fill" : "Unavailable"}
                      </span>
                    </Button>
                  );
                })}
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                Demo credentials are public to visitors. Use disposable
                accounts only; never configure real or production accounts here.
              </p>
            </section>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Contact your administrator if you need access.
            </p>

          </div>
        </div>
      </div>
    </main>
  );
}