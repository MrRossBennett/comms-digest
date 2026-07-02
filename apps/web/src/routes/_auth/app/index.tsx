import {
  formatRoutineSchedule,
  type DayPlan,
  type DayPlanEntry,
  type Digest,
  type HouseholdRoutine,
  type SchoolCommunication,
  type ValidatedExtraction,
} from "@repo/intelligence";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/components/dialog";
import { TooltipButton } from "@repo/ui/components/tooltip-button";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import {
  CalendarIcon,
  CheckIcon,
  EyeOffIcon,
  FileTextIcon,
  InboxIcon,
  LoaderCircleIcon,
  MailIcon,
  PencilIcon,
  Repeat2Icon,
  SmartphoneIcon,
  Settings2Icon,
} from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { digestEvidenceKey } from "#/lib/digest-item-status";
import { $getDayPlan } from "#/lib/household-day-plan.functions";
import {
  $setHouseholdDigestItemDismissed,
  $setHouseholdResponsibilityCompleted,
} from "#/lib/household-digest.functions";

export const Route = createFileRoute("/_auth/app/")({
  validateSearch: z.object({ date: z.iso.date().optional() }),
  loaderDeps: ({ search }) => ({ date: search.date }),
  loader: async ({ deps }) => {
    const dayPlanData = await $getDayPlan({ data: { date: deps.date } });
    if (!dayPlanData) throw redirect({ to: "/app/onboarding" });
    return { dayPlanData };
  },
  component: TodaysToDos,
});

function TodaysToDos() {
  const { dayPlanData } = Route.useLoaderData();
  const router = useRouter();
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

  const { household } = dayPlanData;
  const [childFilter, setChildFilter] = useState<string | null>(null);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {dayPlanData.hasEvidence ? formatDate(dayPlanData.dayPlan.date) : "Your Household"}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {dayPlanHeading(dayPlanData.dayPlan.date, dayPlanData.today)}
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
          <Button variant="outline" render={<Link to="/app/delivery" />} nativeButton={false}>
            <SmartphoneIcon />
            Delivery
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

      {household.children.length > 1 ? (
        <ChildFilter
          householdChildren={household.children}
          selectedChildId={childFilter}
          onSelect={setChildFilter}
        />
      ) : null}

      {dayPlanData.hasEvidence ? (
        <DayPlanGroups
          dayPlan={dayPlanData.dayPlan}
          routines={dayPlanData.routines}
          communications={dayPlanData.communications}
          householdChildren={household.children}
          selectedChildId={childFilter}
          claimsById={claimsById(dayPlanData.digest)}
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
          onDismissedChange={(entry, dismissed) =>
            dismissalMutation.mutate({
              claimIds: entry.claimIds ?? [],
              responsibilityIds: entry.responsibilityId ? [entry.responsibilityId] : [],
              dismissed,
            })
          }
        />
      ) : (
        <EmptyDayPlan />
      )}
    </main>
  );
}

function dayPlanHeading(planDate: string, today: string) {
  if (planDate === today) return "Today's to-dos";
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (planDate === tomorrow.toISOString().slice(0, 10)) return "For tomorrow…";
  return "Day Plan";
}

function EmptyDayPlan() {
  return (
    <section className="rounded-2xl border border-dashed bg-background p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-muted p-2 text-muted-foreground">
            <MailIcon className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold tracking-tight">Your to-do list isn't ready yet</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              Confirm Communication Sources, then fetch new communications from the Digest to
              produce your first Day Plan.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link to="/app/sources" />} nativeButton={false}>
            <Settings2Icon />
            Review Sources
          </Button>
          <Button variant="outline" render={<Link to="/app/digest" />} nativeButton={false}>
            <InboxIcon />
            Go to Digest
          </Button>
        </div>
      </div>
    </section>
  );
}

function ChildFilter({
  householdChildren,
  selectedChildId,
  onSelect,
}: {
  householdChildren: Array<{ id: string; displayName: string }>;
  selectedChildId: string | null;
  onSelect: (childId: string | null) => void;
}) {
  const chipClass = (active: boolean) =>
    active
      ? "rounded-full border border-primary bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
      : "rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground hover:bg-muted";

  return (
    <fieldset className="mb-8 flex flex-wrap gap-2" aria-label="Filter by student">
      <button
        type="button"
        className={chipClass(selectedChildId === null)}
        onClick={() => onSelect(null)}
      >
        Everyone
      </button>
      {householdChildren.map((householdChild) => (
        <button
          key={householdChild.id}
          type="button"
          className={chipClass(selectedChildId === householdChild.id)}
          onClick={() => onSelect(householdChild.id)}
        >
          {householdChild.displayName}
        </button>
      ))}
    </fieldset>
  );
}

function DayPlanGroups({
  dayPlan,
  routines,
  communications,
  householdChildren,
  selectedChildId,
  claimsById,
  pendingResponsibilityId,
  pendingDismissedItemKey,
  onStatusChange,
  onDismissedChange,
}: {
  dayPlan: DayPlan;
  routines: HouseholdRoutine[];
  communications: SchoolCommunication[];
  householdChildren: Array<{ id: string; displayName: string }>;
  selectedChildId: string | null;
  claimsById: Map<string, ValidatedExtraction["claims"][number]>;
  pendingResponsibilityId?: string;
  pendingDismissedItemKey?: string;
  onStatusChange: (responsibilityId: string, completed: boolean) => void;
  onDismissedChange: (entry: DayPlanEntry, dismissed: boolean) => void;
}) {
  const routinesById = new Map(routines.map((routine) => [routine.id, routine]));
  const sharedProps = {
    communications,
    householdChildren,
    claimsById,
    routinesById,
    pendingResponsibilityId,
    pendingDismissedItemKey,
    onStatusChange,
    onDismissedChange,
  };

  // A household-wide entry (no specific students) always applies; otherwise it
  // must include the filtered student.
  const matchesChild = (entry: DayPlanEntry) =>
    selectedChildId === null ||
    entry.childIds.length === 0 ||
    entry.childIds.includes(selectedChildId);
  // Responsibilities and routines are things you complete; claims are events and
  // information you only need to be aware of. They read as two different jobs.
  const todosOf = (entries: DayPlanEntry[]) =>
    entries.filter((entry) => entry.source !== "claim" && matchesChild(entry));
  const fyiOf = (entries: DayPlanEntry[]) =>
    entries.filter((entry) => entry.source === "claim" && matchesChild(entry));

  const keyDates = [...fyiOf(dayPlan.today), ...fyiOf(dayPlan.comingUp)];

  return (
    <div className="grid gap-8">
      <DayPlanSection
        id="overdue"
        title="Overdue"
        tone="danger"
        description="Carried forward from earlier — these still need action."
        entries={todosOf(dayPlan.overdue)}
        {...sharedProps}
      />
      <DayPlanSection
        id="today"
        title="Today"
        entries={todosOf(dayPlan.today)}
        emptyMessage="Nothing due today."
        {...sharedProps}
      />
      <DayPlanSection
        id="this-week"
        title="This week"
        description="Due over the next seven days."
        entries={todosOf(dayPlan.comingUp)}
        {...sharedProps}
      />
      <DayPlanSection
        id="no-deadline"
        title="Earlier emails"
        description="No deadline — most recent first."
        entries={todosOf(dayPlan.noDate)}
        {...sharedProps}
      />
      <DayPlanSection
        id="key-dates"
        title="Key dates"
        tone="separated"
        description="Events coming up — worth a note in the diary, nothing to action."
        entries={keyDates}
        {...sharedProps}
      />
    </div>
  );
}

function DayPlanSection({
  id,
  title,
  description,
  tone,
  entries,
  emptyMessage,
  communications,
  householdChildren,
  claimsById,
  routinesById,
  pendingResponsibilityId,
  pendingDismissedItemKey,
  onStatusChange,
  onDismissedChange,
}: {
  id: string;
  title: string;
  description?: string;
  tone?: "danger" | "separated";
  entries: DayPlanEntry[];
  emptyMessage?: string;
  communications: SchoolCommunication[];
  householdChildren: Array<{ id: string; displayName: string }>;
  claimsById: Map<string, ValidatedExtraction["claims"][number]>;
  routinesById: Map<string, HouseholdRoutine>;
  pendingResponsibilityId?: string;
  pendingDismissedItemKey?: string;
  onStatusChange: (responsibilityId: string, completed: boolean) => void;
  onDismissedChange: (entry: DayPlanEntry, dismissed: boolean) => void;
}) {
  if (entries.length === 0 && !emptyMessage) return null;

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={tone === "separated" ? "border-t pt-8" : undefined}
    >
      <div className="mb-3">
        <h2
          id={`${id}-heading`}
          className={
            tone === "danger"
              ? "font-semibold tracking-tight text-destructive"
              : "font-semibold tracking-tight"
          }
        >
          {title}
          {tone === "danger" ? ` · ${entries.length}` : ""}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {entries.length > 0 ? (
        <div className="grid gap-3">
          {entries.map((entry) => (
            <DayPlanEntryCard
              key={dayPlanEntryKey(entry)}
              entry={entry}
              communications={communications}
              householdChildren={householdChildren}
              claims={(entry.claimIds ?? []).flatMap((claimId) => claimsById.get(claimId) ?? [])}
              routine={entry.routineId ? routinesById.get(entry.routineId) : undefined}
              pending={
                (entry.source === "responsibility" &&
                  entry.responsibilityId === pendingResponsibilityId) ||
                digestEvidenceKey(entry.claimIds ?? []) === pendingDismissedItemKey
              }
              onStatusChange={onStatusChange}
              onDismissedChange={onDismissedChange}
            />
          ))}
        </div>
      ) : (
        <EmptySection>{emptyMessage}</EmptySection>
      )}
    </section>
  );
}

function DayPlanEntryCard({
  entry,
  communications,
  householdChildren,
  claims,
  routine,
  pending,
  onStatusChange,
  onDismissedChange,
}: {
  entry: DayPlanEntry;
  communications: SchoolCommunication[];
  householdChildren: Array<{ id: string; displayName: string }>;
  claims: ValidatedExtraction["claims"];
  routine?: HouseholdRoutine;
  pending: boolean;
  onStatusChange: (responsibilityId: string, completed: boolean) => void;
  onDismissedChange: (entry: DayPlanEntry, dismissed: boolean) => void;
}) {
  const names = householdChildren
    .filter(({ id }) => entry.childIds.includes(id))
    .map(({ displayName }) => displayName);

  return (
    <article className="rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            {entry.source === "claim" && entry.date ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <CalendarIcon className="size-3" />
                {formatDate(entry.date)}
              </span>
            ) : null}
            {entry.source === "routine" ? (
              <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Household Routine
              </span>
            ) : null}
            {names.map((name) => (
              <Badge key={name} variant="outline">
                {name}
              </Badge>
            ))}
          </div>
          <h3 className="font-semibold tracking-tight">{entry.title}</h3>
          {entryDetail(entry, routine) ? (
            <p className="text-sm text-muted-foreground">{entryDetail(entry, routine)}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {claims.length > 0 ? (
            <SourcesButton communications={communications} claims={claims} />
          ) : null}
          {entryActions(entry, pending, onStatusChange, onDismissedChange).map((action) => {
            const completing = action.isCompleteAction && action.pending;
            return (
              <TooltipButton
                key={action.label}
                type="button"
                variant="outline"
                size="icon-sm"
                tooltip={action.label}
                disabled={action.pending}
                onClick={action.onClick}
                className={
                  completing
                    ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-500 hover:text-white"
                    : undefined
                }
              >
                {completing ? (
                  <CheckIcon />
                ) : action.pending ? (
                  <LoaderCircleIcon className="animate-spin" />
                ) : (
                  action.icon
                )}
              </TooltipButton>
            );
          })}
        </div>
      </div>
    </article>
  );
}

type EntryAction = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  pending: boolean;
  isCompleteAction?: boolean;
};

function entryActions(
  entry: DayPlanEntry,
  pending: boolean,
  onStatusChange: (responsibilityId: string, completed: boolean) => void,
  onDismissedChange: (entry: DayPlanEntry, dismissed: boolean) => void,
): EntryAction[] {
  if (entry.source === "routine") return [];

  const dismissAction: EntryAction = {
    label: "Dismiss",
    icon: <EyeOffIcon />,
    onClick: () => onDismissedChange(entry, true),
    pending,
  };

  if (entry.source === "claim" || !entry.responsibilityId) return [dismissAction];

  return [
    dismissAction,
    {
      label: "Mark completed",
      icon: <CheckIcon />,
      onClick: () => onStatusChange(entry.responsibilityId!, true),
      pending,
      isCompleteAction: true,
    },
  ];
}

function entryDetail(entry: DayPlanEntry, routine?: HouseholdRoutine) {
  if (entry.source === "routine") {
    return [entry.date ? formatDate(entry.date) : undefined, routineSchedule(routine)]
      .filter(Boolean)
      .join(" · ");
  }
  if (!entry.date) {
    return entry.receivedAt ? `From ${formatDateTime(entry.receivedAt)}` : undefined;
  }
  // Events (claims) show their date as a calendar pill instead, so only
  // responsibilities need a "Due" line here.
  return entry.source === "responsibility" ? `Due ${formatDate(entry.date)}` : undefined;
}

function routineSchedule(routine?: HouseholdRoutine) {
  return routine ? `Every ${formatRoutineSchedule(routine.weekdays)}` : undefined;
}

function dayPlanEntryKey(entry: DayPlanEntry) {
  return [entry.source, entry.responsibilityId, entry.routineId, ...(entry.claimIds ?? [])]
    .filter(Boolean)
    .join(":");
}

function claimsById(digest: Digest) {
  return new Map(
    [...digest.actNow, ...digest.comingUp, ...digest.goodToKnow]
      .flatMap((item) => item.claims)
      .map((claim) => [claim.id, claim] as const),
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
      <TooltipButton
        type="button"
        variant="outline"
        size="icon-sm"
        tooltip="Sources"
        onClick={() => setOpen(true)}
      >
        <FileTextIcon />
      </TooltipButton>
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
