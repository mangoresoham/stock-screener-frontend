import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — Stock Screener" },
      { name: "description", content: "Request a password reset link." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  // No input -- there's only one account for this whole deployment, so there's nothing
  // to type in (see POST /auth/forgot-password's backend docstring). The button just
  // requests a reset link to whichever recovery address is configured.
  const submit = useMutation({
    mutationFn: () => api.forgotPassword(),
    onSuccess: (res) => toast.success(res.message),
    onError: (e) => {
      const msg = e instanceof ApiError ? e.detail : (e as Error).message;
      toast.error("Couldn't request a reset link", { description: msg });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <Link to="/" className="flex items-center justify-center gap-1.5 text-sm font-semibold tracking-tight">
          <span className="text-signal">◆</span> Screener
        </Link>

        <Card className="p-6 space-y-4">
          <div className="space-y-1">
            <h1 className="text-base font-semibold tracking-tight">Forgot password</h1>
            <p className="text-xs text-muted-foreground">
              We'll send a reset link to the recovery email address configured for this
              deployment. If you're not sure which address that is, check with whoever set up
              this instance.
            </p>
          </div>

          {submit.isSuccess ? (
            <p className="text-xs text-pass">{submit.data.message}</p>
          ) : (
            <Button className="w-full" onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? "Sending…" : "Send reset link"}
            </Button>
          )}

          <Link
            to="/login"
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            <ArrowLeft className="size-3" />
            Back to log in
          </Link>
        </Card>
      </div>
    </div>
  );
}
