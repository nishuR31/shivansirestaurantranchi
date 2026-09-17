import { useCallback, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, MessageCircle, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL, fetchAPI } from "@/lib/db";
import { SiteFooter } from "@/components/site-footer";
import { requestOrderHistoryCode, getOrdersByPhone } from "@/lib/orders.functions";
import { saveCustomerSession } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  validateSearch: z.object({
    redir: z.string().optional().catch(""),
  }),
  head: () => ({
    meta: [
      { title: "Sign up — Maa Tara Sweets" },
      { name: "description", content: "Create a new account at Maa Tara Sweets." },
    ],
  }),
  component: SignupPage,
});

type Tab = "whatsapp" | "email";
type WaStage = "phone" | "otp";

const emailSignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const waPhoneSchema = z.object({
  phone: z
    .string()
    .regex(
      /^(?:\+?91[\-\s]?)?[6-9]\d{9}$/,
      "Enter a valid 10-digit Indian phone number.",
    ),
});

const waOtpSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d+$/, "Code must be numeric"),
});

export function SignupForm({
  redir = "",
  onSuccessProp,
}: {
  redir?: string;
  onSuccessProp?: (data: { customer: any; profileToken: string; phone: string }) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("whatsapp");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  // WhatsApp Auth State
  const [waStage, setWaStage] = useState<WaStage>("phone");
  const [confirmedPhone, setConfirmedPhone] = useState("");

  // Forms
  const emailForm = useForm<z.infer<typeof emailSignupSchema>>({
    resolver: zodResolver(emailSignupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const waPhoneForm = useForm<z.infer<typeof waPhoneSchema>>({
    resolver: zodResolver(waPhoneSchema),
    defaultValues: { phone: "" },
  });

  const waOtpForm = useForm<z.infer<typeof waOtpSchema>>({
    resolver: zodResolver(waOtpSchema),
    defaultValues: { code: "" },
  });

  // ── Email/Password handlers ─────────────────────────────────────────────────
  async function onEmailSubmit(data: z.infer<typeof emailSignupSchema>) {
    setBusy(true);
    try {
      await fetchAPI<any>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: data.email.trim().toLowerCase(),
          password: data.password,
          name: data.name.trim(),
        }),
        headers: { "Content-Type": "application/json" },
      });
      toast.success("Account created! Logging you in...");

      // Auto-login after signup
      const res = await fetchAPI<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: data.email.trim().toLowerCase(),
          password: data.password,
        }),
        headers: { "Content-Type": "application/json" },
      });
      const payload = res?.data ?? res;
      await queryClient.invalidateQueries({ queryKey: ["auth_me"] });

      if (onSuccessProp) {
        const userObj = payload;
        const phoneNum = userObj?.phone ?? data.email;
        const profToken = userObj?.profileToken ?? userObj?.token ?? "";
        onSuccessProp({
          customer: { ...userObj },
          profileToken: profToken,
          phone: phoneNum,
        });
        return;
      }
      navigate({ to: redir || "/my-orders", replace: true });
    } catch (error: any) {
      toast.error(error?.message ?? "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── WhatsApp handlers ───────────────────────────────────────────────────────
  async function onWaPhoneSubmit(data: z.infer<typeof waPhoneSchema>) {
    setBusy(true);
    try {
      const cleanPhone = data.phone.trim();
      const res = await requestOrderHistoryCode({ phone: cleanPhone });
      setConfirmedPhone(cleanPhone);
      setWaStage("otp");
      toast.success(
        res?.delivered
          ? "A 6-digit code has been sent to your WhatsApp."
          : "If that number is on WhatsApp, a code is on its way.",
      );
    } catch (error: any) {
      toast.error(
        error?.message ?? error?.toString() ?? "Failed to send code. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onWaOtpSubmit(data: z.infer<typeof waOtpSchema>) {
    setBusy(true);
    try {
      // For WhatsApp, login and signup are functionally the same API
      const result = await getOrdersByPhone({
        phone: confirmedPhone,
        code: data.code.trim(),
      });
      if (!result) {
        toast.error("No profile found. Place an order first to create your account.");
        return;
      }
      const customer = (result as any).customer;
      const profileToken = (result as any).profileToken;

      if (onSuccessProp) {
        onSuccessProp({ customer, profileToken, phone: confirmedPhone });
        return;
      }
      saveCustomerSession({
        phone: confirmedPhone,
        name: customer.name ?? confirmedPhone,
        profileToken,
      });
      toast.success(`Welcome, ${customer.name ?? ""}!`);
      navigate({ to: redir || "/my-orders", replace: true });
    } catch (error: any) {
      toast.error(
        error?.message ??
          error?.toString() ??
          "That code is invalid or expired. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const showSharedFooter = tab === "email" || (tab === "whatsapp" && waStage === "phone");

  return (
    <div className="mx-auto max-w-md w-full space-y-8">
      <div className="glass animate-rise rounded-3xl p-8 space-y-6">
        <header className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[image:var(--gradient-primary)]">
            <UserPlus className="size-6 text-primary-foreground" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold">Create an Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign up to track your orders and earn loyalty points.
          </p>
        </header>

        <div className="flex gap-1 rounded-2xl bg-background/40 p-1">
          <button
            type="button"
            id="tab-whatsapp"
            onClick={() => setTab("whatsapp")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition-colors ${
              tab === "whatsapp"
                ? "bg-[image:var(--gradient-primary)] text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageCircle className="size-4" />
            WhatsApp
          </button>
          <button
            type="button"
            id="tab-email"
            onClick={() => setTab("email")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition-colors ${
              tab === "email"
                ? "bg-[image:var(--gradient-primary)] text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="size-4" />
            Email
          </button>
        </div>

        {/* WhatsApp Tab */}
        {tab === "whatsapp" && (
          <div className="space-y-4">
            {waStage === "phone" ? (
              <form
                onSubmit={waPhoneForm.handleSubmit(onWaPhoneSubmit)}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="wa-phone">WhatsApp phone number</Label>
                  <Input
                    id="wa-phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="98765 43210"
                    maxLength={16}
                    autoComplete="tel"
                    {...waPhoneForm.register("phone")}
                  />
                  {waPhoneForm.formState.errors.phone && (
                    <p className="text-xs text-destructive mt-1">
                      {waPhoneForm.formState.errors.phone.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  variant="hero"
                  className="w-full rounded-full"
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <MessageCircle className="size-4" />
                  )}
                  Send WhatsApp code
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  We'll send a 6-digit code to your WhatsApp. No password needed.
                </p>
              </form>
            ) : (
              <form
                onSubmit={waOtpForm.handleSubmit(onWaOtpSubmit)}
                className="space-y-4"
              >
                <p className="text-center text-sm text-muted-foreground">
                  Enter the 6-digit code sent to{" "}
                  <span className="font-medium text-foreground">{confirmedPhone}</span> on
                  WhatsApp.
                </p>
                <div>
                  <Label htmlFor="wa-otp">6-digit code</Label>
                  <Input
                    id="wa-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    {...waOtpForm.register("code", {
                      onChange: (e) =>
                        (e.target.value = e.target.value.replace(/\D/g, "")),
                    })}
                    autoFocus
                  />
                  {waOtpForm.formState.errors.code && (
                    <p className="text-xs text-destructive mt-1">
                      {waOtpForm.formState.errors.code.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  variant="hero"
                  className="w-full rounded-full"
                  disabled={busy}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} Verify &
                  sign up
                </Button>
                <Button
                  type="button"
                  variant="glass"
                  className="w-full rounded-full"
                  onClick={() => {
                    setWaStage("phone");
                    waOtpForm.reset();
                  }}
                >
                  Use a different number
                </Button>
              </form>
            )}
          </div>
        )}

        {/* Email Tab */}
        {tab === "email" && (
          <div className="space-y-4">
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="signup-name">Name</Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="John Doe"
                  {...emailForm.register("name")}
                />
                {emailForm.formState.errors.name && (
                  <p className="text-xs text-destructive mt-1">
                    {emailForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...emailForm.register("email")}
                />
                {emailForm.formState.errors.email && (
                  <p className="text-xs text-destructive mt-1">
                    {emailForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="pr-10"
                    placeholder="Create a password"
                    {...emailForm.register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                {emailForm.formState.errors.password && (
                  <p className="text-xs text-destructive mt-1">
                    {emailForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="hero"
                className="w-full rounded-full"
                disabled={busy}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} Sign up
              </Button>
            </form>
          </div>
        )}

        {/* Shared Bottom Section */}
        {showSharedFooter && (
          <div className="space-y-4 pt-2">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full flex items-center justify-center gap-2"
              onClick={() => (window.location.href = `${API_BASE_URL}/auth/google/login`)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="24"
                viewBox="0 0 24 24"
                width="24"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
              Sign up with Google
            </Button>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Already have an account?{" "}
              <Link
                to="/login"
                search={{ redir }}
                className="text-primary hover:underline font-medium"
              >
                Log in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SignupPage() {
  const { redir } = Route.useSearch();

  return (
    <main className="min-h-[80vh] px-4 py-12 flex flex-col items-center">
      <SignupForm redir={redir} />
      <div className="mt-auto w-full max-w-4xl pt-12">
        <SiteFooter />
      </div>
    </main>
  );
}
