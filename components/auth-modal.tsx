"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, TrendingUp, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

/* ── Schemas ── */
const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number"),
});

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;

/* ── Props ── */
interface AuthModalProps {
  open: boolean;
  defaultTab?: "login" | "signup";
  onClose: () => void;
}

export function AuthModal({ open, defaultTab = "login", onClose }: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "signup">(defaultTab);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, signup } = useAuth();
  const router = useRouter();

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const signupForm = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  const switchTab = (t: "login" | "signup") => {
    setTab(t);
    setError("");
    loginForm.reset();
    signupForm.reset();
    setShowPassword(false);
  };

  const redirectAfterAuth = () => {
    onClose();
    router.push("/");
  };

  const onLogin = async (data: LoginForm) => {
    setError("");
    try {
      await login(data.email, data.password);
      redirectAfterAuth();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
    }
  };

  const onSignup = async (data: SignupForm) => {
    setError("");
    try {
      await signup(data.name, data.email, data.password);
      redirectAfterAuth();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign up failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden" showCloseButton={false}>
        {/* Header */}
        <div className="flex flex-col items-center gap-3 px-8 pt-8 pb-6 border-b border-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand">
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground">
              Predict<span className="text-brand">One</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {tab === "login" ? "Welcome back" : "Create your account"}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex w-full rounded-lg bg-secondary p-1 mt-1">
            <button
              onClick={() => switchTab("login")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-sm font-medium transition-all",
                tab === "login"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Log In
            </button>
            <button
              onClick={() => switchTab("signup")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-sm font-medium transition-all",
                tab === "signup"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Login Form */}
          {tab === "login" && (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="flex flex-col gap-4">
              <Field label="Email" error={loginForm.formState.errors.email?.message}>
                <input
                  {...loginForm.register("email")}
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={inputCls(!!loginForm.formState.errors.email)}
                />
              </Field>
              <Field label="Password" error={loginForm.formState.errors.password?.message}>
                <div className="relative">
                  <input
                    {...loginForm.register("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="Your password"
                    autoComplete="current-password"
                    className={cn(inputCls(!!loginForm.formState.errors.password), "pr-10")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Button
                type="submit"
                className="w-full bg-brand hover:bg-brand/90 text-primary-foreground font-semibold"
                disabled={loginForm.formState.isSubmitting}
              >
                {loginForm.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Log In"
                )}
              </Button>
            </form>
          )}

          {/* Signup Form */}
          {tab === "signup" && (
            <form onSubmit={signupForm.handleSubmit(onSignup)} className="flex flex-col gap-4">
              <Field label="Full Name" error={signupForm.formState.errors.name?.message}>
                <input
                  {...signupForm.register("name")}
                  type="text"
                  placeholder="John Doe"
                  autoComplete="name"
                  className={inputCls(!!signupForm.formState.errors.name)}
                />
              </Field>
              <Field label="Email" error={signupForm.formState.errors.email?.message}>
                <input
                  {...signupForm.register("email")}
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={inputCls(!!signupForm.formState.errors.email)}
                />
              </Field>
              <Field label="Password" error={signupForm.formState.errors.password?.message}>
                <div className="relative">
                  <input
                    {...signupForm.register("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 chars, upper, lower, digit"
                    autoComplete="new-password"
                    className={cn(inputCls(!!signupForm.formState.errors.password), "pr-10")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Button
                type="submit"
                className="w-full bg-brand hover:bg-brand/90 text-primary-foreground font-semibold"
                disabled={signupForm.formState.isSubmitting}
              >
                {signupForm.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          )}

          <p className="mt-5 text-center text-xs text-muted-foreground">
            {tab === "login" ? (
              <>
                Don't have an account?{" "}
                <button onClick={() => switchTab("signup")} className="text-brand hover:underline font-medium">
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={() => switchTab("login")} className="text-brand hover:underline font-medium">
                  Log in
                </button>
              </>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Helpers ── */
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return cn(
    "w-full rounded-lg border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all",
    "focus:border-brand/50 focus:ring-1 focus:ring-brand/20",
    hasError ? "border-destructive" : "border-border"
  );
}
