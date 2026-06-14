import { authClient } from "@repo/auth/auth-client";
import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  InboxIcon,
  LoaderCircleIcon,
  MailIcon,
  RefreshCwIcon,
  TestTube2Icon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  $discoverSampleSources,
  $getSourceReview,
  $saveCommunicationSourceReview,
  $scanGmailSources,
} from "#/lib/communication-source.functions";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

type SourceReview = NonNullable<Awaited<ReturnType<typeof $getSourceReview>>>;
type Source = SourceReview["sources"][number];
type HouseholdSchool = SourceReview["household"]["schools"][number];
type HouseholdChild = SourceReview["household"]["children"][number];

export const Route = createFileRoute("/_auth/app/sources")({
  loader: async () => {
    const sourceReview = await $getSourceReview();
    if (!sourceReview) throw redirect({ to: "/app/onboarding" });
    return sourceReview;
  },
  component: SourceReviewPage,
});

function SourceReviewPage() {
  const sourceReview = Route.useLoaderData();
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const discoveryMutation = useMutation({
    mutationFn: (mode: "gmail" | "sample") =>
      mode === "gmail" ? $scanGmailSources() : $discoverSampleSources(),
    onSuccess: async () => {
      await router.invalidate({ sync: true });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Source discovery failed.");
    },
  });
  const reviewMutation = useMutation({
    mutationFn: $saveCommunicationSourceReview,
    onSuccess: async () => {
      await router.invalidate({ sync: true });
    },
    onError: () => {
      toast.error("We could not save this Source Review decision.");
    },
  });
  const pendingSources = sourceReview.sources.filter(({ status }) => status === "pending");
  const confirmedSources = sourceReview.sources.filter(({ status }) => status === "confirmed");
  const rejectedSources = sourceReview.sources.filter(({ status }) => status === "rejected");

  const connectGmail = async () => {
    setConnecting(true);
    const result = await authClient.linkSocial({
      provider: "google",
      callbackURL: "/app/sources",
      scopes: [GMAIL_SCOPE],
    });

    if (result.error) {
      setConnecting(false);
      toast.error(result.error.message ?? "Gmail could not be connected.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <Button
        variant="ghost"
        className="mb-6 -ml-3"
        render={<Link to="/app" />}
        nativeButton={false}
      >
        <ArrowLeftIcon />
        Back to Household
      </Button>

      <div className="mb-8 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Communication onboarding</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Choose what counts as school communication
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Comms Digest suggests recurring senders. You decide which ones belong in your Household
          Digest and who they apply to.
        </p>
      </div>

      <section className="mb-8 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-muted p-2 text-muted-foreground">
              <MailIcon className="size-4" />
            </div>
            <div>
              <h2 className="font-semibold tracking-tight">
                {sourceReview.gmailConnected
                  ? "Gmail connected"
                  : sourceReview.gmailNeedsReconnect
                    ? "Reconnect Gmail"
                    : "Connect Gmail"}
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                {sourceReview.gmailConnected
                  ? "Read-only access is ready. Scanning happens only when you ask."
                  : sourceReview.gmailNeedsReconnect
                    ? "Your previous access has expired. Reconnect once to keep Gmail access working."
                    : "Grant read-only Gmail access separately from sign-in. Comms Digest cannot send, edit, or delete email."}
              </p>
            </div>
          </div>
          {sourceReview.gmailConnected ? (
            <Button
              type="button"
              disabled={discoveryMutation.isPending}
              onClick={() => discoveryMutation.mutate("gmail")}
            >
              {discoveryMutation.isPending && discoveryMutation.variables === "gmail" ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <RefreshCwIcon />
              )}
              Scan last 90 days
            </Button>
          ) : (
            <Button type="button" disabled={connecting} onClick={connectGmail}>
              {connecting ? <LoaderCircleIcon className="animate-spin" /> : <MailIcon />}
              {sourceReview.gmailNeedsReconnect ? "Reconnect Gmail" : "Connect Gmail"}
            </Button>
          )}
        </div>
      </section>

      {sourceReview.sources.length === 0 ? (
        <section className="rounded-2xl border border-dashed bg-background p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-muted p-2 text-muted-foreground">
                <InboxIcon className="size-4" />
              </div>
              <div>
                <h2 className="font-semibold tracking-tight">
                  {sourceReview.gmailConnected
                    ? "No sources found yet"
                    : "No suggested sources yet"}
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                  {sourceReview.gmailConnected
                    ? "Run a Gmail scan to find recurring school senders."
                    : "Try the workflow with synthetic senders, or connect Gmail and run a scan."}
                </p>
              </div>
            </div>
            {sourceReview.gmailConnected ? null : (
              <Button
                type="button"
                variant="outline"
                disabled={discoveryMutation.isPending}
                onClick={() => discoveryMutation.mutate("sample")}
              >
                {discoveryMutation.isPending && discoveryMutation.variables === "sample" ? (
                  <LoaderCircleIcon className="animate-spin" />
                ) : (
                  <TestTube2Icon />
                )}
                Use sample sources
              </Button>
            )}
          </div>
        </section>
      ) : (
        <div className="space-y-8">
          <SourceGroup
            title="Needs review"
            description="Confirm useful senders or reject anything unrelated."
            sources={pendingSources}
            sourceReview={sourceReview}
            pendingSourceId={
              reviewMutation.isPending ? reviewMutation.variables?.data.sourceId : undefined
            }
            onReview={(data) => reviewMutation.mutate({ data })}
          />
          <SourceGroup
            title="Confirmed sources"
            description="Messages from these senders can enter the Digest pipeline."
            sources={confirmedSources}
            sourceReview={sourceReview}
            pendingSourceId={
              reviewMutation.isPending ? reviewMutation.variables?.data.sourceId : undefined
            }
            onReview={(data) => reviewMutation.mutate({ data })}
          />
          <RejectedSourceGroup
            sources={rejectedSources}
            sourceReview={sourceReview}
            pendingSourceId={
              reviewMutation.isPending ? reviewMutation.variables?.data.sourceId : undefined
            }
            onReview={(data) => reviewMutation.mutate({ data })}
          />
        </div>
      )}
    </main>
  );
}

function SourceGroup({
  title,
  description,
  sources,
  sourceReview,
  pendingSourceId,
  onReview,
}: {
  title: string;
  description: string;
  sources: Source[];
  sourceReview: SourceReview;
  pendingSourceId?: string;
  onReview: (data: Parameters<typeof $saveCommunicationSourceReview>[0]["data"]) => void;
}) {
  if (sources.length === 0) return null;

  return (
    <section>
      <div className="mb-3">
        <h2 className="font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4">
        {sources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            schools={sourceReview.household.schools}
            householdChildren={sourceReview.household.children}
            pending={pendingSourceId === source.id}
            onReview={onReview}
          />
        ))}
      </div>
    </section>
  );
}

function RejectedSourceGroup({
  sources,
  sourceReview,
  pendingSourceId,
  onReview,
}: {
  sources: Source[];
  sourceReview: SourceReview;
  pendingSourceId?: string;
  onReview: (data: Parameters<typeof $saveCommunicationSourceReview>[0]["data"]) => void;
}) {
  if (sources.length === 0) return null;

  return (
    <details className="group overflow-hidden rounded-2xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 hover:bg-muted/40 sm:p-6 [&::-webkit-details-marker]:hidden">
        <div>
          <h2 className="font-semibold tracking-tight">
            Rejected sources
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({sources.length})
            </span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These senders are excluded from the Digest pipeline.
          </p>
        </div>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-4 border-t bg-muted/20 p-4 sm:p-6">
        {sources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            schools={sourceReview.household.schools}
            householdChildren={sourceReview.household.children}
            pending={pendingSourceId === source.id}
            onReview={onReview}
          />
        ))}
      </div>
    </details>
  );
}

function SourceCard({
  source,
  schools,
  householdChildren,
  pending,
  onReview,
}: {
  source: Source;
  schools: HouseholdSchool[];
  householdChildren: HouseholdChild[];
  pending: boolean;
  onReview: (data: {
    sourceId: string;
    status: "confirmed" | "rejected";
    audience: "household" | "school" | "children";
    schoolId: string | null;
    childIds: string[];
  }) => void;
}) {
  const initialSchoolId = source.schoolId ?? schools[0]?.id ?? null;
  const [audience, setAudience] = useState(
    source.status === "confirmed" ? source.audience : "school",
  );
  const [schoolId, setSchoolId] = useState(initialSchoolId);
  const [childIds, setChildIds] = useState(source.childIds);
  const schoolChildren = householdChildren.filter(
    (householdChild) => householdChild.schoolId === schoolId,
  );

  const review = (status: "confirmed" | "rejected") => {
    onReview({
      sourceId: source.id,
      status,
      audience,
      schoolId: audience === "household" ? null : schoolId,
      childIds: audience === "children" ? childIds : [],
    });
  };

  return (
    <article
      className={
        source.status === "rejected"
          ? "rounded-2xl border border-destructive/25 bg-card p-5 shadow-sm sm:p-6"
          : "rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold tracking-tight">{source.senderName}</h3>
              <SourceStatus status={source.status} />
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{source.senderAddress}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {source.messageCount} matching {source.messageCount === 1 ? "message" : "messages"}
              {source.lastSeenAt ? ` · Last seen ${formatDate(source.lastSeenAt)}` : ""}
              {source.discovery === "sample" ? " · Sample" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => review("rejected")}
            >
              <XIcon />
              Reject
            </Button>
            <Button
              type="button"
              disabled={
                pending ||
                (audience !== "household" && !schoolId) ||
                (audience === "children" && childIds.length === 0)
              }
              onClick={() => review("confirmed")}
            >
              {pending ? <LoaderCircleIcon className="animate-spin" /> : <CheckIcon />}
              Confirm
            </Button>
          </div>
        </div>

        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={`${source.id}-audience`}>Applies to</Label>
            <select
              id={`${source.id}-audience`}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={audience}
              onChange={(event) => {
                const nextAudience = event.target.value;
                if (
                  nextAudience === "household" ||
                  nextAudience === "school" ||
                  nextAudience === "children"
                ) {
                  setAudience(nextAudience);
                }
              }}
            >
              <option value="household">Whole Household</option>
              <option value="school">Everyone at one School</option>
              <option value="children">Specific Students</option>
            </select>
          </div>

          {audience === "household" ? null : (
            <div className="grid gap-2">
              <Label htmlFor={`${source.id}-school`}>School</Label>
              <select
                id={`${source.id}-school`}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={schoolId ?? ""}
                onChange={(event) => {
                  setSchoolId(event.target.value);
                  setChildIds([]);
                }}
              >
                {schools.map((householdSchool) => (
                  <option key={householdSchool.id} value={householdSchool.id}>
                    {householdSchool.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {audience === "children" ? (
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium">Students</p>
              <div className="flex flex-wrap gap-2">
                {schoolChildren.map((householdChild) => {
                  const selected = childIds.includes(householdChild.id);
                  return (
                    <label
                      key={householdChild.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        aria-label={`Apply to ${householdChild.displayName}`}
                        checked={selected}
                        onChange={() =>
                          setChildIds((current) =>
                            selected
                              ? current.filter((childId) => childId !== householdChild.id)
                              : [...current, householdChild.id],
                          )
                        }
                      />
                      {householdChild.displayName}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </fieldset>
      </div>
    </article>
  );
}

function SourceStatus({ status }: { status: Source["status"] }) {
  const label =
    status === "pending" ? "Needs review" : status === "confirmed" ? "Confirmed" : "Rejected";
  const className =
    status === "rejected"
      ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
      : status === "confirmed"
        ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground";

  return <span className={className}>{label}</span>;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
