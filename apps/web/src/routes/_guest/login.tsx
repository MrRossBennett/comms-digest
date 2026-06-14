import { authClient } from "@repo/auth/auth-client";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { InboxIcon, LoaderCircleIcon, MailCheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ContinueWithGoogleButton } from "#/components/continue-with-google-button";

export const Route = createFileRoute("/_guest/login")({
  component: SignInForm,
});

function SignInForm() {
  const { redirectUrl } = Route.useRouteContext();
  const [requestedEmail, setRequestedEmail] = useState("");

  const mutation = useMutation({
    mutationFn: async (email: string) => {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: redirectUrl,
        newUserCallbackURL: redirectUrl,
        errorCallbackURL: "/login",
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return email;
    },
    onSuccess: setRequestedEmail,
    onError: (error) => {
      toast.error(error.message || "Your sign-in link could not be sent.");
    },
  });

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mutation.isPending) return;

    const emailInput = event.currentTarget.elements.namedItem("email");
    if (!(emailInput instanceof HTMLInputElement)) return;

    const email = emailInput.value.trim();
    if (!email) return;
    mutation.mutate(email);
  };

  if (requestedEmail) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <MailCheckIcon className="size-8" />
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Check your email</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            We sent a one-time sign-in link to <span className="font-medium">{requestedEmail}</span>
            . It expires in 10 minutes.
          </p>
        </div>
        <Button variant="outline" onClick={() => setRequestedEmail("")}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <Link to="/" className="flex flex-col items-center gap-2 font-medium">
              <div className="flex h-8 w-8 items-center justify-center rounded-md">
                <InboxIcon className="size-6" />
              </div>
              <span className="sr-only">Comms Digest</span>
            </Link>
            <h1 className="text-xl font-bold">Sign in to Comms Digest</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              We&apos;ll email you a one-time link. No password required.
            </p>
          </div>
          <div className="flex flex-col gap-5">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                readOnly={mutation.isPending}
                required
              />
            </div>
            <Button type="submit" className="mt-2 w-full" size="lg" disabled={mutation.isPending}>
              {mutation.isPending && <LoaderCircleIcon className="animate-spin" />}
              {mutation.isPending ? "Sending link..." : "Continue with email"}
            </Button>
          </div>
          <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-background px-2 text-muted-foreground">Or</span>
          </div>
          <ContinueWithGoogleButton callbackURL={redirectUrl} disabled={mutation.isPending} />
        </div>
      </form>

      <div className="text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="underline underline-offset-4">
          Sign up
        </Link>
      </div>
    </div>
  );
}
