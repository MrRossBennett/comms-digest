import type { DayPlan } from "@repo/intelligence";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon, LoaderCircleIcon, MessageSquareTextIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  $deleteDeliveryContact,
  $getDeliverySettings,
  $replaceDeliveryContact,
  $requestDeliveryContactCode,
  $setDeliveryConsent,
  $verifyDeliveryContact,
} from "#/lib/delivery-contact.functions";

export const Route = createFileRoute("/_auth/app/delivery")({
  loader: async () => {
    const settings = await $getDeliverySettings();
    if (!settings) throw redirect({ to: "/app/onboarding" });
    return { settings };
  },
  component: DeliverySettingsPage,
});

function DeliverySettingsPage() {
  const { settings } = Route.useLoaderData();
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState(settings.contact?.phoneNumber ?? "+44");
  const [code, setCode] = useState("");
  const refresh = async () => router.invalidate({ sync: true });
  const replaceMutation = useMutation({
    mutationFn: () => $replaceDeliveryContact({ data: { phoneNumber } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Verification code sent.");
    },
    onError: () => toast.error("Delivery Contact could not be saved."),
  });
  const verifyMutation = useMutation({
    mutationFn: () => $verifyDeliveryContact({ data: { code } }),
    onSuccess: async () => {
      setCode("");
      await refresh();
      toast.success("Delivery Contact verified and opted in.");
    },
    onError: () => toast.error("That verification code is invalid or expired."),
  });
  const requestMutation = useMutation({
    mutationFn: () => $requestDeliveryContactCode(),
    onSuccess: () => toast.success("A new verification code was sent."),
    onError: () => toast.error("Wait a minute before requesting another code."),
  });
  const consentMutation = useMutation({
    mutationFn: (optedIn: boolean) => $setDeliveryConsent({ data: { optedIn } }),
    onSuccess: refresh,
    onError: () => toast.error("Delivery consent could not be updated."),
  });
  const deleteMutation = useMutation({
    mutationFn: () => $deleteDeliveryContact(),
    onSuccess: async () => {
      setPhoneNumber("+44");
      await refresh();
      toast.success("Delivery Contact deleted.");
    },
    onError: () => toast.error("Delivery Contact could not be deleted."),
  });
  const pending =
    replaceMutation.isPending ||
    verifyMutation.isPending ||
    requestMutation.isPending ||
    consentMutation.isPending ||
    deleteMutation.isPending;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <Button
        variant="ghost"
        className="mb-6 -ml-3"
        render={<Link to="/app" />}
        nativeButton={false}
      >
        <ArrowLeftIcon />
        Back to Day Plan
      </Button>

      <div className="mb-8 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Evening delivery</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Delivery Contact</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Receive a short “For tomorrow…” text after the evening school-email sync. The full Day
          Plan stays behind the secure link.
        </p>
      </div>

      <section className="rounded-2xl border bg-background p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Mobile number</h2>
            <p className="text-sm text-muted-foreground">Use international format, such as +44…</p>
          </div>
          {settings.contact ? <ConsentBadge consent={settings.contact.consent} /> : null}
        </div>

        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            replaceMutation.mutate();
          }}
        >
          <div className="grid flex-1 gap-2">
            <Label htmlFor="delivery-phone">Mobile number</Label>
            <Input
              id="delivery-phone"
              type="tel"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              disabled={pending}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {replaceMutation.isPending ? <LoaderCircleIcon className="animate-spin" /> : null}
            {settings.contact ? "Replace number" : "Send code"}
          </Button>
        </form>

        {settings.contact?.consent === "unverified" ? (
          <form
            className="mt-5 rounded-xl bg-muted/50 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              verifyMutation.mutate();
            }}
          >
            <Label htmlFor="verification-code">Six-digit verification code</Label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                id="verification-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                disabled={pending}
              />
              <Button type="submit" disabled={pending || code.length !== 6}>
                Verify
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => requestMutation.mutate()}
              >
                Send another code
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => deleteMutation.mutate()}
              >
                <Trash2Icon /> Delete number
              </Button>
            </div>
          </form>
        ) : null}

        {settings.contact?.consent === "opted_in" ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => consentMutation.mutate(false)}
            >
              Opt out
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => deleteMutation.mutate()}>
              <Trash2Icon /> Delete number
            </Button>
          </div>
        ) : null}
        {settings.contact?.consent === "opted_out" ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button disabled={pending} onClick={() => consentMutation.mutate(true)}>
              Opt in again
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => deleteMutation.mutate()}>
              <Trash2Icon /> Delete number
            </Button>
          </div>
        ) : null}
      </section>

      <section className="mt-8" aria-labelledby="delivery-history-heading">
        <h2 id="delivery-history-heading" className="font-semibold">
          Delivered Day Plans
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Fixed records show what the evening text said, even when the live Day Plan later changes.
        </p>
        {settings.deliveries.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
            No evening Day Plans have been composed yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {settings.deliveries.map((delivery) => (
              <DeliveryRecord key={delivery.planDate} delivery={delivery} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ConsentBadge({ consent }: { consent: "unverified" | "opted_in" | "opted_out" }) {
  return (
    <Badge variant={consent === "opted_in" ? "default" : "secondary"}>
      {consent === "opted_in"
        ? "Verified · opted in"
        : consent === "opted_out"
          ? "Opted out"
          : "Unverified"}
    </Badge>
  );
}

function DeliveryRecord({
  delivery,
}: {
  delivery: {
    planDate: string;
    planSnapshot: unknown;
    messageText: string | null;
    status: "attempting" | "skipped" | "sent" | "delivered" | "failed";
    lastError: string | null;
  };
}) {
  const plan = delivery.planSnapshot as DayPlan;
  const itemCount = plan.overdue.length + plan.today.length + plan.comingUp.length;
  return (
    <article className="rounded-2xl border bg-background p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">For {formatDate(delivery.planDate)}</h3>
        <Badge
          variant={delivery.status === "failed" ? "outline" : "secondary"}
          className={delivery.status === "failed" ? "text-destructive" : undefined}
        >
          {delivery.status}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {itemCount} dated items in the fixed Day Plan
      </p>
      {delivery.messageText ? (
        <div className="mt-3 flex gap-2 rounded-xl bg-muted/60 p-3 text-sm">
          <MessageSquareTextIcon className="mt-0.5 size-4 shrink-0" />
          <p>{delivery.messageText}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          The plan was empty, so no text was sent.
        </p>
      )}
      {delivery.lastError ? (
        <p className="mt-3 text-sm text-destructive">{delivery.lastError}</p>
      ) : null}
      {itemCount > 0 ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium">View fixed Day Plan</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {[...plan.overdue, ...plan.today, ...plan.comingUp].map((entry, index) => (
              <li key={`${entry.source}-${entry.responsibilityId ?? entry.routineId ?? index}`}>
                {entry.title}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}
