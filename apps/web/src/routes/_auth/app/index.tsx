import type { Digest, SchoolCommunication, ValidatedExtraction } from "@repo/intelligence";
import { Button } from "@repo/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import {
  CalendarDaysIcon,
  CheckIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  FileTextIcon,
  InfoIcon,
  LoaderCircleIcon,
  MailIcon,
  EyeOffIcon,
  PencilIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Settings2Icon,
} from "lucide-react";
import { Fragment } from "react";
import { toast } from "sonner";

import { digestEvidenceKey, isDigestItemDismissed } from "#/lib/digest-item-status";
import { getErrorMessage } from "#/lib/error-message";
import {
  $fetchNewCommunications,
  $getHouseholdDigest,
  $setHouseholdDigestItemDismissed,
  $setHouseholdResponsibilityCompleted,
} from "#/lib/household-digest.functions";
import { $getHousehold } from "#/lib/household.functions";

export const Route = createFileRoute("/_auth/app/")({
  loader: async () => {
    const [household, digestData] = await Promise.all([$getHousehold(), $getHouseholdDigest()]);
    if (!household) throw redirect({ to: "/app/onboarding" });
    return { household, digestData };
  },
  component: HouseholdHome,
});

function HouseholdHome() {
  const { household, digestData } = Route.useLoaderData();
  const router = useRouter();
  const fetchMutation = useMutation({
    mutationFn: $fetchNewCommunications,
    onSuccess: async ({ importedCount }) => {
      await router.invalidate({ sync: true });
      toast.success(
        importedCount === 0
          ? "Digest is already up to date."
          : `Added ${importedCount} new ${importedCount === 1 ? "communication" : "communications"}.`,
      );
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Communications could not be fetched."));
    },
  });
  const statusMutation = useMutation({
    mutationFn: (data: { responsibilityId: string; completed: boolean }) =>
      $setHouseholdResponsibilityCompleted({ data }),
    onSuccess: async () => {
      await router.invalidate({ sync: true });
    },
    onError: () => {
      toast.error("Responsibility status could not be updated.");
    },
  });
  const dismissalMutation = useMutation({
    mutationFn: (data: { claimIds: string[]; responsibilityIds: string[]; dismissed: boolean }) =>
      $setHouseholdDigestItemDismissed({ data }),
    onSuccess: async () => {
      await router.invalidate({ sync: true });
    },
    onError: () => {
      toast.error("Digest item status could not be updated.");
    },
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {digestData?.generatedAt
              ? `Household Digest · Updated ${formatDateTime(digestData.generatedAt)}`
              : "Your Household"}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            What matters from school
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {household.children.map((householdChild) => (
              <span key={householdChild.id}>
                {householdChild.displayName} · {householdChild.schoolYear}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={fetchMutation.isPending}
            onClick={() => fetchMutation.mutate(undefined)}
          >
            {fetchMutation.isPending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <RefreshCwIcon />
            )}
            Fetch new communications
          </Button>
          <Button variant="outline" render={<Link to="/app/sources" />} nativeButton={false}>
            <Settings2Icon />
            Sources
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Edit Household"
            render={<Link to="/app/onboarding" />}
            nativeButton={false}
          >
            <PencilIcon />
          </Button>
        </div>
      </div>
      {fetchMutation.error ? (
        <p role="alert" className="-mt-6 mb-8 text-sm text-destructive">
          {getErrorMessage(fetchMutation.error, "Communications could not be fetched.")}
        </p>
      ) : null}

      {digestData?.digest ? (
        <HouseholdDigest
          digest={digestData.digest}
          communications={digestData.communications}
          householdChildren={household.children}
          completedResponsibilityIds={digestData.completedResponsibilityIds}
          dismissedClaimIds={digestData.dismissedClaimIds}
          dismissedResponsibilityIds={digestData.dismissedResponsibilityIds}
          pendingResponsibilityId={
            statusMutation.isPending ? statusMutation.variables?.responsibilityId : undefined
          }
          pendingDismissedItemKey={
            dismissalMutation.isPending
              ? digestEvidenceKey(dismissalMutation.variables.claimIds)
              : undefined
          }
          onStatusChange={(responsibilityId, completed) =>
            statusMutation.mutate({ responsibilityId, completed })
          }
          onDismissedChange={(item, dismissed) =>
            dismissalMutation.mutate({
              claimIds: item.claims.map(({ id }) => id),
              responsibilityIds: item.responsibilities.map(({ id }) => id),
              dismissed,
            })
          }
        />
      ) : (
        <EmptyDigest />
      )}
    </main>
  );
}

function EmptyDigest() {
  return (
    <section className="rounded-2xl border border-dashed bg-background p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-muted p-2 text-muted-foreground">
            <MailIcon className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold tracking-tight">No Household Digest yet</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              Confirm Communication Sources, then fetch new communications to produce the first
              cited Digest.
            </p>
          </div>
        </div>
        <Button variant="outline" render={<Link to="/app/sources" />} nativeButton={false}>
          <Settings2Icon />
          Review Sources
        </Button>
      </div>
    </section>
  );
}

function HouseholdDigest({
  digest,
  communications,
  householdChildren,
  completedResponsibilityIds,
  dismissedClaimIds,
  dismissedResponsibilityIds,
  pendingResponsibilityId,
  pendingDismissedItemKey,
  onStatusChange,
  onDismissedChange,
}: {
  digest: Digest;
  communications: SchoolCommunication[];
  householdChildren: Array<{ id: string; displayName: string; schoolYear: string }>;
  completedResponsibilityIds: string[];
  dismissedClaimIds: string[];
  dismissedResponsibilityIds: string[];
  pendingResponsibilityId?: string;
  pendingDismissedItemKey?: string;
  onStatusChange: (responsibilityId: string, completed: boolean) => void;
  onDismissedChange: (item: DigestItemType, dismissed: boolean) => void;
}) {
  const completed = new Set(completedResponsibilityIds);
  const dismissedClaims = new Set(dismissedClaimIds);
  const dismissedResponsibilities = new Set(dismissedResponsibilityIds);
  const isDismissed = (item: DigestItemType) =>
    isDigestItemDismissed(item, dismissedClaims, dismissedResponsibilities);
  const dismissedItems = [...digest.actNow, ...digest.comingUp, ...digest.goodToKnow].filter(
    isDismissed,
  );
  const actNow = digest.actNow.filter(
    (item) => !isDismissed(item) && item.responsibilities.some(({ id }) => !completed.has(id)),
  );
  const completedItems = digest.actNow.filter(
    (item) =>
      !isDismissed(item) &&
      item.responsibilities.length > 0 &&
      item.responsibilities.every(({ id }) => completed.has(id)),
  );
  const comingUp = digest.comingUp.filter((item) => !isDismissed(item));
  const goodToKnow = digest.goodToKnow.filter((item) => !isDismissed(item));

  return (
    <div className="grid gap-8">
      <DigestSection
        title="Act Now"
        description="Responsibilities that need your attention."
        icon={<CheckCircle2Icon />}
      >
        {actNow.length > 0 ? (
          <div className="grid gap-3">
            {actNow.map((item) => (
              <DigestItem
                key={digestEvidenceKey(item.claims.map(({ id }) => id))}
                item={item}
                householdChildren={householdChildren}
                communications={communications}
                actions={[
                  {
                    label: "Dismiss",
                    icon: <EyeOffIcon />,
                    variant: "outline",
                    onClick: () => onDismissedChange(item, true),
                    pending:
                      digestEvidenceKey(item.claims.map(({ id }) => id)) ===
                      pendingDismissedItemKey,
                  },
                  {
                    label: "Mark completed",
                    icon: <CheckIcon />,
                    variant: "default",
                    onClick: () => {
                      const responsibility = item.responsibilities[0];
                      if (responsibility) onStatusChange(responsibility.id, true);
                    },
                    pending: item.responsibilities[0]?.id === pendingResponsibilityId,
                  },
                ]}
              />
            ))}
          </div>
        ) : (
          <EmptySection>Nothing needs your attention.</EmptySection>
        )}
      </DigestSection>

      <DigestSection
        title="Coming Up"
        description="Dates and activities to anticipate."
        icon={<CalendarDaysIcon />}
      >
        {comingUp.length > 0 ? (
          <div className="grid gap-3">
            {comingUp.map((item) => (
              <DigestItem
                key={digestEvidenceKey(item.claims.map(({ id }) => id))}
                item={item}
                householdChildren={householdChildren}
                communications={communications}
                detail={formatItemDate(item)}
                actions={[
                  {
                    label: "Dismiss",
                    icon: <EyeOffIcon />,
                    variant: "outline",
                    onClick: () => onDismissedChange(item, true),
                    pending:
                      digestEvidenceKey(item.claims.map(({ id }) => id)) ===
                      pendingDismissedItemKey,
                  },
                ]}
              />
            ))}
          </div>
        ) : (
          <EmptySection>Nothing currently scheduled.</EmptySection>
        )}
      </DigestSection>

      <DigestSection
        title="Good to Know"
        description="Useful updates that do not need action."
        icon={<InfoIcon />}
      >
        {goodToKnow.length > 0 ? (
          <div className="grid gap-3">
            {goodToKnow.map((item) => (
              <DigestItem
                key={digestEvidenceKey(item.claims.map(({ id }) => id))}
                item={item}
                householdChildren={householdChildren}
                communications={communications}
                actions={[
                  {
                    label: "Dismiss",
                    icon: <EyeOffIcon />,
                    variant: "outline",
                    onClick: () => onDismissedChange(item, true),
                    pending:
                      digestEvidenceKey(item.claims.map(({ id }) => id)) ===
                      pendingDismissedItemKey,
                  },
                ]}
              />
            ))}
          </div>
        ) : (
          <EmptySection>No other updates.</EmptySection>
        )}
      </DigestSection>

      {completedItems.length > 0 ? (
        <DigestSection
          title="Completed"
          description="Responsibilities already handled."
          icon={<CheckIcon />}
        >
          <div className="grid gap-3">
            {completedItems.map((item) => (
              <DigestItem
                key={digestEvidenceKey(item.claims.map(({ id }) => id))}
                item={item}
                householdChildren={householdChildren}
                communications={communications}
                actions={[
                  {
                    label: "Reopen",
                    icon: <RotateCcwIcon />,
                    variant: "outline",
                    onClick: () => {
                      const responsibility = item.responsibilities[0];
                      if (responsibility) onStatusChange(responsibility.id, false);
                    },
                    pending: item.responsibilities[0]?.id === pendingResponsibilityId,
                  },
                ]}
              />
            ))}
          </div>
        </DigestSection>
      ) : null}

      {dismissedItems.length > 0 ? (
        <DismissedDigestItems
          items={dismissedItems}
          householdChildren={householdChildren}
          communications={communications}
          pendingDismissedItemKey={pendingDismissedItemKey}
          onReopen={(item) => onDismissedChange(item, false)}
        />
      ) : null}
    </div>
  );
}

type DigestItemType = Digest["actNow"][number];
type DigestItemAction = {
  label: string;
  icon: React.ReactNode;
  variant: "default" | "outline";
  onClick: () => void;
  pending: boolean;
};

function DigestItem({
  item,
  householdChildren,
  communications,
  detail,
  actions = [],
}: {
  item: DigestItemType;
  householdChildren: Array<{ id: string; displayName: string }>;
  communications: SchoolCommunication[];
  detail?: string;
  actions?: DigestItemAction[];
}) {
  const names = householdChildren
    .filter(({ id }) => item.childIds.includes(id))
    .map(({ displayName }) => displayName);

  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0 space-y-2">
          <h3 className="font-semibold tracking-tight">{item.title}</h3>
          {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
          <p className="text-xs font-medium text-muted-foreground">
            Applies to {formatNames(names)}
          </p>
        </div>
        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.label}
                type="button"
                variant={action.variant}
                disabled={action.pending}
                onClick={action.onClick}
              >
                {action.pending ? <LoaderCircleIcon className="animate-spin" /> : action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      <SourceDisclosure communications={communications} claims={item.claims} />
    </article>
  );
}

function DismissedDigestItems({
  items,
  householdChildren,
  communications,
  pendingDismissedItemKey,
  onReopen,
}: {
  items: DigestItemType[];
  householdChildren: Array<{ id: string; displayName: string }>;
  communications: SchoolCommunication[];
  pendingDismissedItemKey?: string;
  onReopen: (item: DigestItemType) => void;
}) {
  return (
    <details className="group overflow-hidden rounded-2xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 hover:bg-muted/40 sm:p-6 [&::-webkit-details-marker]:hidden">
        <div>
          <h2 className="font-semibold tracking-tight">
            Dismissed
            <span className="ml-2 text-sm font-normal text-muted-foreground">({items.length})</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Hidden from your active Household Digest.
          </p>
        </div>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 border-t bg-muted/20 p-4 sm:p-6">
        {items.map((item) => (
          <DigestItem
            key={digestEvidenceKey(item.claims.map(({ id }) => id))}
            item={item}
            householdChildren={householdChildren}
            communications={communications}
            detail={formatItemDate(item)}
            actions={[
              {
                label: "Reopen",
                icon: <RotateCcwIcon />,
                variant: "outline",
                onClick: () => onReopen(item),
                pending:
                  digestEvidenceKey(item.claims.map(({ id }) => id)) === pendingDismissedItemKey,
              },
            ]}
          />
        ))}
      </div>
    </details>
  );
}

function SourceDisclosure({
  communications,
  claims,
}: {
  communications: SchoolCommunication[];
  claims: ValidatedExtraction["claims"];
}) {
  const evidence = communications.flatMap((communication) => {
    const citations = claims.flatMap((claim) =>
      claim.citations.filter((citation) => citation.communicationId === communication.id),
    );
    return citations.length > 0 ? [{ communication, citations }] : [];
  });

  return (
    <details className="group border-t">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium hover:bg-muted/50 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <FileTextIcon className="size-4 text-muted-foreground" />
          View sources
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-5 bg-muted/30 px-5 py-6 sm:px-6">
        {evidence.map(({ communication, citations }) => (
          <div key={communication.id} className="rounded-xl border bg-background p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <p className="text-sm font-medium">{communication.subject}</p>
              <time className="text-xs text-muted-foreground">
                {formatDateTime(communication.receivedAt)}
              </time>
            </div>
            <p className="text-sm leading-7 whitespace-pre-wrap text-muted-foreground">
              <HighlightedSource sourceText={communication.sourceText} citations={citations} />
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}

function HighlightedSource({
  sourceText,
  citations,
}: {
  sourceText: string;
  citations: ValidatedExtraction["claims"][number]["citations"];
}) {
  const ranges = citations
    .map(({ start, end }) => ({ start, end }))
    .sort((left, right) => left.start - right.start);
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      parts.push({ text: sourceText.slice(cursor, range.start), highlighted: false });
    }
    if (range.end > cursor) {
      const start = Math.max(cursor, range.start);
      parts.push({ text: sourceText.slice(start, range.end), highlighted: true });
      cursor = range.end;
    }
  }
  if (cursor < sourceText.length) {
    parts.push({ text: sourceText.slice(cursor), highlighted: false });
  }

  return parts.map((part, index) => (
    <Fragment key={`${index}-${part.text}`}>
      {part.highlighted ? (
        <mark className="rounded bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-400/25">
          {part.text}
        </mark>
      ) : (
        part.text
      )}
    </Fragment>
  ));
}

function DigestSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const headingId = `${title.toLocaleLowerCase("en-GB").replaceAll(" ", "-")}-heading`;
  return (
    <section aria-labelledby={headingId}>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-muted-foreground [&_svg]:size-5">{icon}</span>
        <div>
          <h2 id={headingId} className="font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptySection({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed bg-background px-5 py-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function formatNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "this Household";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function formatItemDate(item: Digest["comingUp"][number]) {
  const date = item.claims.find(({ date }) => date?.resolvedDate)?.date?.resolvedDate;
  return date ? formatDate(date) : undefined;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
