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

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

interface AuthModalProps {
  open: boolean;
  defaultTab?: "login" | "signup";
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const form = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onLogin = async (data: LoginForm) => {
    setError("");
    try {
      await login(data.email, data.password);
      onClose();
      router.push("/");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
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
            <p className="text-sm text-muted-foreground mt-0.5">Welcome back</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={form.handleSubmit(onLogin)} className="flex flex-col gap-4">
            <Field label="Email" error={form.formState.errors.email?.message}>
              <input
                {...form.register("email")}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className={inputCls(!!form.formState.errors.email)}
              />
            </Field>
            <Field label="Password" error={form.formState.errors.password?.message}>
              <div className="relative">
                <input
                  {...form.register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                  autoComplete="current-password"
                  className={cn(inputCls(!!form.formState.errors.password), "pr-10")}
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
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Log In"
              )}
            </Button>
          </form>
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
