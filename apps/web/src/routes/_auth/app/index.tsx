import {
  formatRoutineSchedule,
  nextRoutineOccurrence,
  type Digest,
  type HouseholdRoutine,
  type SchoolCommunication,
  type ValidatedExtraction,
} from "@repo/intelligence";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/components/dialog";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import {
  CheckIcon,
  FileTextIcon,
  LoaderCircleIcon,
  MailIcon,
  EyeOffIcon,
  PencilIcon,
  RefreshCwIcon,
  Repeat2Icon,
  RotateCcwIcon,
  Settings2Icon,
  ChevronDownIcon,
} from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";

import { digestEvidenceKey, isDigestItemDismissed } from "#/lib/digest-item-status";
import { getErrorMessage } from "#/lib/error-message";
import {
  $fetchNewCommunications,
  $getHouseholdDigest,
  $setHouseholdDigestItemDismissed,
  $setHouseholdResponsibilityCompleted,
} from "#/lib/household-digest.functions";
import { $listHouseholdRoutines } from "#/lib/household-routine.functions";
import { $getHousehold } from "#/lib/household.functions";

export const Route = createFileRoute("/_auth/app/")({
  loader: async () => {
    const [household, digestData, routines] = await Promise.all([
      $getHousehold(),
      $getHouseholdDigest(),
      $listHouseholdRoutines(),
    ]);
    if (!household) throw redirect({ to: "/app/onboarding" });
    return { household, digestData, routines };
  },
  component: HouseholdHome,
});

function HouseholdHome() {
  const { household, digestData, routines } = Route.useLoaderData();
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
          <Button variant="outline" render={<Link to="/app/routines" />} nativeButton={false}>
            <Repeat2Icon />
            Routines
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

      {digestData?.digest || routines.length > 0 ? (
        <HouseholdDigest
          digest={digestData?.digest ?? { actNow: [], comingUp: [], goodToKnow: [] }}
          routines={routines}
          communications={digestData?.communications ?? []}
          householdChildren={household.children}
          completedResponsibilityIds={digestData?.completedResponsibilityIds ?? []}
          dismissedClaimIds={digestData?.dismissedClaimIds ?? []}
          dismissedResponsibilityIds={digestData?.dismissedResponsibilityIds ?? []}
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
  routines,
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
  routines: HouseholdRoutine[];
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
  const [selectedChildId, setSelectedChildId] = useState<string>();
  const [selectedFilter, setSelectedFilter] = useState<DigestFilter>("all");
  const completed = new Set(completedResponsibilityIds);
  const dismissedClaims = new Set(dismissedClaimIds);
  const dismissedResponsibilities = new Set(dismissedResponsibilityIds);
  const isDismissed = (item: DigestItemType) =>
    isDigestItemDismissed(item, dismissedClaims, dismissedResponsibilities);
  const appliesToSelectedStudent = (item: DigestItemType) =>
    !selectedChildId || item.childIds.includes(selectedChildId);
  const categorizedItems: CategorizedDigestItem[] = [
    ...digest.actNow.map((item) => ({ item, category: "actNow" as const })),
    ...digest.comingUp.map((item) => ({ item, category: "comingUp" as const })),
    ...digest.goodToKnow.map((item) => ({ item, category: "goodToKnow" as const })),
  ];
  const routineOccurrences: RoutineOccurrence[] = routines.flatMap((routine) => {
    const date = nextRoutineOccurrence(routine, todayInLondon());
    return date ? [{ routine, date }] : [];
  });
  const dismissedItems = sortDigestItems(
    categorizedItems.filter(
      ({ item, category }) =>
        isDismissed(item) &&
        appliesToSelectedStudent(item) &&
        (selectedFilter === "all" || category === selectedFilter),
    ),
  );
  const visibleDigestItems = sortDigestItems(
    categorizedItems.filter(({ item, category }) => {
      if (!appliesToSelectedStudent(item) || isDismissed(item)) return false;
      const itemIsCompleted = isDigestItemCompleted(item, category, completed);
      if (selectedFilter === "completed") return itemIsCompleted;
      if (selectedFilter !== "all" && category !== selectedFilter) return false;
      if (category !== "actNow") return true;
      return itemIsCompleted || item.responsibilities.some(({ id }) => !completed.has(id));
    }),
  );
  const visibleRoutineOccurrences = routineOccurrences.filter(
    ({ routine }) =>
      (!selectedChildId || routine.studentIds.includes(selectedChildId)) &&
      (selectedFilter === "all" || selectedFilter === "comingUp"),
  );
  const visibleItems = sortTimelineItems([
    ...visibleDigestItems.map((value) => ({ kind: "digest" as const, value })),
    ...visibleRoutineOccurrences.map((value) => ({ kind: "routine" as const, value })),
  ]);

  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        {householdChildren.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2" aria-label="Filter Digest by Student">
            <span className="mr-1 text-sm font-medium text-muted-foreground">Student:</span>
            <Button
              type="button"
              size="sm"
              variant={selectedChildId ? "outline" : "default"}
              aria-pressed={!selectedChildId}
              onClick={() => setSelectedChildId(undefined)}
            >
              All students
            </Button>
            {householdChildren.map(({ id, displayName }) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={selectedChildId === id ? "default" : "outline"}
                aria-pressed={selectedChildId === id}
                onClick={() => setSelectedChildId(id)}
              >
                {displayName}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2" aria-label="Filter Digest items">
          <span className="mr-1 text-sm font-medium text-muted-foreground">Show:</span>
          {(["all", "actNow", "comingUp", "goodToKnow", "completed"] as const).map((filter) => (
            <Button
              key={filter}
              type="button"
              size="sm"
              variant={selectedFilter === filter ? "default" : "outline"}
              aria-pressed={selectedFilter === filter}
              onClick={() => setSelectedFilter(filter)}
            >
              {filter === "all"
                ? "All"
                : filter === "completed"
                  ? "Completed"
                  : categoryLabels[filter]}
            </Button>
          ))}
        </div>
      </div>

      <section aria-labelledby="digest-items-heading">
        <div className="mb-3">
          <h2 id="digest-items-heading" className="font-semibold tracking-tight">
            Digest items
          </h2>
          <p className="text-sm text-muted-foreground">Soonest dated items appear first.</p>
        </div>
        {visibleItems.length > 0 ? (
          <div className="grid gap-3">
            {visibleItems.map((timelineItem) =>
              timelineItem.kind === "routine" ? (
                <RoutineOccurrenceItem
                  key={`routine:${timelineItem.value.routine.id}`}
                  occurrence={timelineItem.value}
                  householdChildren={householdChildren}
                />
              ) : (
                <DigestItem
                  key={digestEvidenceKey(timelineItem.value.item.claims.map(({ id }) => id))}
                  item={timelineItem.value.item}
                  category={timelineItem.value.category}
                  householdChildren={householdChildren}
                  communications={communications}
                  detail={formatItemDate(timelineItem.value.item)}
                  completed={isDigestItemCompleted(
                    timelineItem.value.item,
                    timelineItem.value.category,
                    completed,
                  )}
                  actions={
                    isDigestItemCompleted(
                      timelineItem.value.item,
                      timelineItem.value.category,
                      completed,
                    )
                      ? [
                          {
                            label: "Reopen",
                            icon: <RotateCcwIcon />,
                            variant: "outline" as const,
                            onClick: () => {
                              const responsibility = timelineItem.value.item.responsibilities[0];
                              if (responsibility) onStatusChange(responsibility.id, false);
                            },
                            pending:
                              timelineItem.value.item.responsibilities[0]?.id ===
                              pendingResponsibilityId,
                          },
                        ]
                      : [
                          {
                            label: "Dismiss",
                            icon: <EyeOffIcon />,
                            variant: "outline" as const,
                            onClick: () => onDismissedChange(timelineItem.value.item, true),
                            pending:
                              digestEvidenceKey(
                                timelineItem.value.item.claims.map(({ id }) => id),
                              ) === pendingDismissedItemKey,
                          },
                          ...(timelineItem.value.category === "actNow"
                            ? [
                                {
                                  label: "Mark completed",
                                  icon: <CheckIcon />,
                                  variant: "default" as const,
                                  onClick: () => {
                                    const responsibility =
                                      timelineItem.value.item.responsibilities[0];
                                    if (responsibility) onStatusChange(responsibility.id, true);
                                  },
                                  pending:
                                    timelineItem.value.item.responsibilities[0]?.id ===
                                    pendingResponsibilityId,
                                },
                              ]
                            : []),
                        ]
                  }
                />
              ),
            )}
          </div>
        ) : (
          <EmptySection>No Digest items match these filters.</EmptySection>
        )}
      </section>

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
type DigestCategory = "actNow" | "comingUp" | "goodToKnow";
type DigestFilter = DigestCategory | "all" | "completed";
type CategorizedDigestItem = { item: DigestItemType; category: DigestCategory };
type RoutineOccurrence = { routine: HouseholdRoutine; date: string };
type TimelineItem =
  | { kind: "digest"; value: CategorizedDigestItem }
  | { kind: "routine"; value: RoutineOccurrence };
const categoryLabels: Record<DigestCategory, string> = {
  actNow: "Act Now",
  comingUp: "Coming Up",
  goodToKnow: "Good to Know",
};
type DigestItemAction = {
  label: string;
  icon: React.ReactNode;
  variant: "default" | "outline";
  onClick: () => void;
  pending: boolean;
};

function DigestItem({
  item,
  category,
  householdChildren,
  communications,
  detail,
  completed = false,
  actions = [],
}: {
  item: DigestItemType;
  category: DigestCategory;
  householdChildren: Array<{ id: string; displayName: string }>;
  communications: SchoolCommunication[];
  detail?: string;
  completed?: boolean;
  actions?: DigestItemAction[];
}) {
  const names = householdChildren
    .filter(({ id }) => item.childIds.includes(id))
    .map(({ displayName }) => displayName);

  return (
    <article className="rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {categoryLabels[category]}
            </span>
            {completed ? (
              <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                Completed
              </span>
            ) : null}
            {names.map((name) => (
              <Badge key={name} variant="outline">
                {name}
              </Badge>
            ))}
          </div>
          <h3 className="font-semibold tracking-tight">{item.title}</h3>
          {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <SourcesButton communications={communications} claims={item.claims} />
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
      </div>
    </article>
  );
}

function RoutineOccurrenceItem({
  occurrence,
  householdChildren,
}: {
  occurrence: RoutineOccurrence;
  householdChildren: Array<{ id: string; displayName: string }>;
}) {
  const names = householdChildren
    .filter(({ id }) => occurrence.routine.studentIds.includes(id))
    .map(({ displayName }) => displayName);

  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Household Routine
            </span>
            {names.map((name) => (
              <Badge key={name} variant="outline">
                {name}
              </Badge>
            ))}
          </div>
          <h3 className="font-semibold tracking-tight">{occurrence.routine.title}</h3>
          <p className="text-sm text-muted-foreground">{formatDate(occurrence.date)}</p>
          <p className="text-xs font-medium text-muted-foreground">
            Every {formatRoutineSchedule(occurrence.routine.weekdays)}
          </p>
          {occurrence.routine.details ? (
            <p className="text-sm leading-6">{occurrence.routine.details}</p>
          ) : null}
        </div>
        <Button variant="outline" render={<Link to="/app/routines" />} nativeButton={false}>
          <PencilIcon />
          Edit Routine
        </Button>
      </div>
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
  items: CategorizedDigestItem[];
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
        {items.map(({ item, category }) => (
          <DigestItem
            key={digestEvidenceKey(item.claims.map(({ id }) => id))}
            item={item}
            category={category}
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

function SourcesButton({
  communications,
  claims,
}: {
  communications: SchoolCommunication[];
  claims: ValidatedExtraction["claims"];
}) {
  const [open, setOpen] = useState(false);
  const evidence = communications.flatMap((communication) => {
    const citations = claims.flatMap((claim) =>
      claim.citations.filter((citation) => citation.communicationId === communication.id),
    );
    return citations.length > 0 ? [{ communication, citations }] : [];
  });

  if (evidence.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <FileTextIcon className="size-3.5" />
        Sources
      </Button>
      <DialogContent className="max-h-[85vh] w-full overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Source communications</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {evidence.map(({ communication, citations }) => (
            <div key={communication.id} className="rounded-xl border bg-muted/30 p-4">
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
      </DialogContent>
    </Dialog>
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

function EmptySection({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed bg-background px-5 py-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function itemDate(item: DigestItemType) {
  return [
    ...item.responsibilities.flatMap(({ dueDate }) => dueDate?.resolvedDate ?? []),
    ...item.claims.flatMap(({ date }) => date?.resolvedDate ?? []),
  ].sort()[0];
}

function isDigestItemCompleted(
  item: DigestItemType,
  category: DigestCategory,
  completedResponsibilityIds: Set<string>,
) {
  return (
    category === "actNow" &&
    item.responsibilities.length > 0 &&
    item.responsibilities.every(({ id }) => completedResponsibilityIds.has(id))
  );
}

function sortDigestItems(items: CategorizedDigestItem[]) {
  return [...items].sort((left, right) => {
    const leftDate = itemDate(left.item);
    const rightDate = itemDate(right.item);
    if (leftDate && rightDate) return leftDate.localeCompare(rightDate);
    if (leftDate) return -1;
    if (rightDate) return 1;
    return left.item.title.localeCompare(right.item.title, "en-GB");
  });
}

function sortTimelineItems(items: TimelineItem[]) {
  return [...items].sort((left, right) => {
    const leftDate = left.kind === "routine" ? left.value.date : itemDate(left.value.item);
    const rightDate = right.kind === "routine" ? right.value.date : itemDate(right.value.item);
    if (leftDate && rightDate) return leftDate.localeCompare(rightDate);
    if (leftDate) return -1;
    if (rightDate) return 1;
    const leftTitle = left.kind === "routine" ? left.value.routine.title : left.value.item.title;
    const rightTitle =
      right.kind === "routine" ? right.value.routine.title : right.value.item.title;
    return leftTitle.localeCompare(rightTitle, "en-GB");
  });
}

function todayInLondon() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatItemDate(item: DigestItemType) {
  const date = itemDate(item);
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
