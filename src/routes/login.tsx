import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Stock Screener" },
      { name: "description", content: "Log in to the stock screener." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  username: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});

type FormValues = z.infer<typeof schema>;

function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, refresh } = useAuth();

  // Already logged in (e.g. navigated here manually, or a second tab) -- go straight to
  // the app instead of showing a login form there's no reason to fill in again.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: "/run" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const submit = useMutation({
    mutationFn: (v: FormValues) => api.login(v.username, v.password),
    onSuccess: async () => {
      await refresh();
      navigate({ to: "/run" });
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.detail : (e as Error).message;
      toast.error("Log in failed", { description: msg });
    },
  });

  if (isLoading || isAuthenticated) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <Link to="/" className="flex items-center justify-center gap-1.5 text-sm font-semibold tracking-tight">
          <span className="text-signal">◆</span> Screener
        </Link>

        <Card className="p-6">
          <form onSubmit={form.handleSubmit((v) => submit.mutate(v))} className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-base font-semibold tracking-tight">Log in</h1>
              <p className="text-xs text-muted-foreground">Instance login for this deployment.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs uppercase tracking-wide text-muted-foreground">
                Username
              </Label>
              <Input
                id="username"
                autoFocus
                autoComplete="username"
                className="font-mono text-xs"
                {...form.register("username")}
              />
              <FieldError name="username" form={form} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs uppercase tracking-wide text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="font-mono text-xs"
                {...form.register("password")}
              />
              <FieldError name="password" form={form} />
            </div>

            <Button type="submit" className="w-full" disabled={submit.isPending}>
              {submit.isPending ? "Logging in…" : "Log in"}
            </Button>

            <div className="text-center">
              <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                Forgot password?
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function FieldError({ name, form }: { name: keyof FormValues; form: ReturnType<typeof useForm<FormValues>> }) {
  const msg = form.formState.errors[name]?.message as string | undefined;
  if (!msg) return null;
  return <p className="text-xs text-fail">{msg}</p>;
}
