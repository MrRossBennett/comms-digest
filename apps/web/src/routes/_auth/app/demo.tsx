import type { Digest, SchoolCommunication, ValidatedExtraction } from "@repo/intelligence";
import { Button } from "@repo/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import {
  CalendarDaysIcon,
  CheckIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  FileTextIcon,
  InfoIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Fragment } from "react";

import { $getDemoDigest, $setDemoResponsibilityCompleted } from "#/lib/demo-digest.functions";

export const Route = createFileRoute("/_auth/app/demo")({
  loader: () => $getDemoDigest(),
  component: AppIndex,
});

function AppIndex() {
  const demo = Route.useLoaderData();
  const router = useRouter();
  const statusMutation = useMutation({
    mutationFn: (data: { responsibilityId: string; completed: boolean }) =>
      $setDemoResponsibilityCompleted({ data }),
    onSuccess: async () => {
      await router.invalidate({ sync: true });
    },
  });

  const updateResponsibility = (responsibilityId: string, completed: boolean) => {
    statusMutation.mutate({ responsibilityId, completed });
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Demo Digest · {formatDate(demo.asOf)}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            What matters from school
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {demo.household.children.map((child) => (
              <span key={child.id}>
                {child.name} · {child.schoolYear}
              </span>
            ))}
          </div>
        </div>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          A synthetic example showing how later School Communications update what your Household
          needs to know.
        </p>
      </div>

      <div className="grid gap-6">
        <DigestSection
          title="Act Now"
          description="Responsibilities that need your attention."
          icon={<CheckCircle2Icon />}
        >
          {demo.digest.actNow.length > 0 ? (
            <div className="grid gap-3">
              {demo.digest.actNow.map((item) => (
                <ResponsibilityItem
                  key={item.title}
                  item={item}
                  householdChildren={demo.household.children}
                  communications={demo.communications}
                  pendingResponsibilityId={
                    statusMutation.isPending
                      ? statusMutation.variables?.responsibilityId
                      : undefined
                  }
                  onStatusChange={updateResponsibility}
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
          {demo.digest.comingUp.length > 0 ? (
            <div className="grid gap-3">
              {demo.digest.comingUp.map((item) => (
                <InformationItem
                  key={item.title}
                  item={item}
                  householdChildren={demo.household.children}
                  communications={demo.communications}
                  detail={formatItemDate(item)}
                  icon={<CalendarDaysIcon className="size-4" />}
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
          <div className="grid gap-3">
            {demo.digest.goodToKnow.map((item) => (
              <InformationItem
                key={item.title}
                item={item}
                householdChildren={demo.household.children}
                communications={demo.communications}
                detail={
                  item.responsibilities.length > 0
                    ? "The payment Responsibility is no longer outstanding."
                    : undefined
                }
                icon={<InfoIcon className="size-4" />}
              />
            ))}
          </div>
        </DigestSection>

        {demo.completed.length > 0 ? (
          <DigestSection
            title="Completed"
            description="Responsibilities you have already handled."
            icon={<CheckIcon />}
          >
            <div className="grid gap-3">
              {demo.completed.map((item) => (
                <CompletedResponsibilityItem
                  key={item.title}
                  item={item}
                  householdChildren={demo.household.children}
                  pendingResponsibilityId={
                    statusMutation.isPending
                      ? statusMutation.variables?.responsibilityId
                      : undefined
                  }
                  onStatusChange={updateResponsibility}
                />
              ))}
            </div>
          </DigestSection>
        ) : null}
      </div>
    </main>
  );
}

function ResponsibilityItem({
  item,
  householdChildren,
  communications,
  pendingResponsibilityId,
  onStatusChange,
}: {
  item: Digest["actNow"][number];
  householdChildren: Array<{ id: string; name: string; schoolYear: string }>;
  communications: SchoolCommunication[];
  pendingResponsibilityId?: string;
  onStatusChange: (responsibilityId: string, completed: boolean) => void;
}) {
  const responsibility = item.responsibilities[0];
  const childNames = relevantChildNames(item, householdChildren);
  const pending = responsibility?.id === pendingResponsibilityId;

  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-muted p-2 text-muted-foreground">
            <CheckCircle2Icon className="size-4" />
          </div>
          <div className="min-w-0 space-y-2">
            <h3 className="font-semibold tracking-tight">{item.title}</h3>
            {responsibility?.dueDate?.resolvedDate ? (
              <p className="text-sm text-muted-foreground">
                Due {formatDate(responsibility.dueDate.resolvedDate)}
              </p>
            ) : null}
            <p className="text-xs font-medium text-muted-foreground">
              Applies to {formatNames(childNames)}
            </p>
          </div>
        </div>
        {responsibility ? (
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={pending}
            onClick={() => onStatusChange(responsibility.id, true)}
          >
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <CheckIcon />}
            Mark completed
          </Button>
        ) : null}
      </div>
      <SourceDisclosure
        communications={communications}
        claims={item.claims}
        supersedesResponsibilities={false}
      />
    </article>
  );
}

function InformationItem({
  item,
  householdChildren,
  communications,
  detail,
  icon,
}: {
  item: Digest["goodToKnow"][number];
  householdChildren: Array<{ id: string; name: string; schoolYear: string }>;
  communications: SchoolCommunication[];
  detail?: string;
  icon: React.ReactNode;
}) {
  const childNames = relevantChildNames(item, householdChildren);
  const supersedesResponsibilities = item.responsibilities.length > 0;

  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-muted p-2 text-muted-foreground">{icon}</div>
          <div className="min-w-0 space-y-2">
            <h3 className="font-semibold tracking-tight">{item.title}</h3>
            {detail ? <p className="text-sm leading-6 text-muted-foreground">{detail}</p> : null}
            <p className="text-xs font-medium text-muted-foreground">
              Applies to {formatNames(childNames)}
            </p>
          </div>
        </div>
      </div>

      <SourceDisclosure
        communications={communications}
        claims={item.claims}
        supersedesResponsibilities={supersedesResponsibilities}
      />
    </article>
  );
}

function CompletedResponsibilityItem({
  item,
  householdChildren,
  pendingResponsibilityId,
  onStatusChange,
}: {
  item: Digest["actNow"][number];
  householdChildren: Array<{ id: string; name: string; schoolYear: string }>;
  pendingResponsibilityId?: string;
  onStatusChange: (responsibilityId: string, completed: boolean) => void;
}) {
  const responsibility = item.responsibilities[0];
  const childNames = relevantChildNames(item, householdChildren);
  const pending = responsibility?.id === pendingResponsibilityId;

  return (
    <article className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <h3 className="font-semibold tracking-tight">{item.title}</h3>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          Applies to {formatNames(childNames)}
        </p>
      </div>
      {responsibility ? (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={pending}
          onClick={() => onStatusChange(responsibility.id, false)}
        >
          {pending ? <LoaderCircleIcon className="animate-spin" /> : <RotateCcwIcon />}
          Reopen
        </Button>
      ) : null}
    </article>
  );
}

function SourceDisclosure({
  communications,
  claims,
  supersedesResponsibilities,
}: {
  communications: SchoolCommunication[];
  claims: ValidatedExtraction["claims"];
  supersedesResponsibilities: boolean;
}) {
  return (
    <details className="group border-t">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium hover:bg-muted/50 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <FileTextIcon className="size-4 text-muted-foreground" />
          View sources
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <EvidenceTrail
        communications={communications}
        claims={claims}
        supersedesResponsibilities={supersedesResponsibilities}
      />
    </details>
  );
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
  return (
    <section aria-labelledby={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-muted-foreground [&_svg]:size-5">{icon}</span>
        <div>
          <h2
            id={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}
            className="font-semibold tracking-tight"
          >
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

function EvidenceTrail({
  communications,
  claims,
  supersedesResponsibilities,
}: {
  communications: SchoolCommunication[];
  claims: ValidatedExtraction["claims"];
  supersedesResponsibilities: boolean;
}) {
  const evidence = communications.flatMap((communication) => {
    const citations = claims.flatMap((claim) =>
      claim.citations.filter((citation) => citation.communicationId === communication.id),
    );
    return citations.length > 0 ? [{ communication, citations }] : [];
  });

  return (
    <div className="space-y-6 bg-muted/30 px-5 py-6 sm:px-6">
      {supersedesResponsibilities ? (
        <div>
          <h4 className="font-medium">How this changed</h4>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            The later cancellation supersedes the earlier swimming activity and its unresolved
            payment Responsibility.
          </p>
        </div>
      ) : (
        <h4 className="font-medium">Supporting School Communication</h4>
      )}
      <ol className="space-y-5">
        {evidence.map(({ communication, citations }, index) => (
          <li key={communication.id} className="relative pl-7">
            <span className="absolute top-1 left-0 flex size-5 items-center justify-center rounded-full border bg-background text-[10px] font-semibold text-muted-foreground">
              {index + 1}
            </span>
            {index < evidence.length - 1 ? (
              <span className="absolute top-6 bottom-[-1.25rem] left-2.5 w-px bg-border" />
            ) : null}
            <div className="rounded-xl border bg-background p-4">
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
          </li>
        ))}
      </ol>
    </div>
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

function formatNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "this Household";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function relevantChildNames(
  item: Digest["actNow"][number],
  householdChildren: Array<{ id: string; name: string }>,
) {
  return householdChildren
    .filter((child) => item.childIds.includes(child.id))
    .map((child) => child.name);
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
    timeZone: "Europe/London",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(value));
}
