import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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

export const Route = createFileRoute("/reset-password")({
  validateSearch: z.object({
    token: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Reset password — Stock Screener" },
      { name: "description", content: "Set a new password." },
    ],
  }),
  component: ResetPasswordPage,
});

const schema = z
  .object({
    new_password: z.string().min(8, "Must be at least 8 characters"),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

type FormValues = z.infer<typeof schema>;

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: "", confirm_password: "" },
  });

  const submit = useMutation({
    mutationFn: (v: FormValues) => api.resetPassword(token!, v.new_password),
    onSuccess: () => {
      toast.success("Password updated", { description: "Log in with your new password." });
      navigate({ to: "/login" });
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.detail : (e as Error).message;
      toast.error("Couldn't reset password", { description: msg, duration: 10_000 });
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6">
          <Link to="/" className="flex items-center justify-center gap-1.5 text-sm font-semibold tracking-tight">
            <span className="text-signal">◆</span> Screener
          </Link>
          <Card className="p-6 space-y-3 text-center">
            <h1 className="text-base font-semibold tracking-tight">Invalid reset link</h1>
            <p className="text-xs text-muted-foreground">
              This link is missing its reset token. Request a new one from the forgot-password
              page.
            </p>
            <Link to="/forgot-password" className="inline-block text-xs text-signal hover:underline">
              Request a new link
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <Link to="/" className="flex items-center justify-center gap-1.5 text-sm font-semibold tracking-tight">
          <span className="text-signal">◆</span> Screener
        </Link>

        <Card className="p-6">
          <form onSubmit={form.handleSubmit((v) => submit.mutate(v))} className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-base font-semibold tracking-tight">Set a new password</h1>
              <p className="text-xs text-muted-foreground">
                This link is single-use and expires 30 minutes after it was requested.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new_password" className="text-xs uppercase tracking-wide text-muted-foreground">
                New password
              </Label>
              <Input
                id="new_password"
                type="password"
                autoFocus
                autoComplete="new-password"
                className="font-mono text-xs"
                {...form.register("new_password")}
              />
              <FieldError name="new_password" form={form} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm_password" className="text-xs uppercase tracking-wide text-muted-foreground">
                Confirm new password
              </Label>
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                className="font-mono text-xs"
                {...form.register("confirm_password")}
              />
              <FieldError name="confirm_password" form={form} />
            </div>

            <Button type="submit" className="w-full" disabled={submit.isPending}>
              {submit.isPending ? "Updating…" : "Update password"}
            </Button>
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
