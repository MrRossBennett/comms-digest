import type { SchoolCommunication, ValidatedExtraction } from "@repo/intelligence";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  FileTextIcon,
  InfoIcon,
} from "lucide-react";
import { Fragment } from "react";

import { $getDemoDigest } from "#/lib/demo-digest.functions";

export const Route = createFileRoute("/_auth/app/")({
  loader: () => $getDemoDigest(),
  component: AppIndex,
});

function AppIndex() {
  const demo = Route.useLoaderData();
  const child = demo.household.children[0];
  const cancellation = demo.digest.goodToKnow[0];

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
          {child ? (
            <p className="text-sm text-muted-foreground">
              {child.name} · {child.schoolYear}
            </p>
          ) : null}
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
          emptyMessage="Nothing needs your attention."
          icon={<CheckCircle2Icon />}
        />
        <DigestSection
          title="Coming Up"
          description="Dates and activities to anticipate."
          emptyMessage="Nothing currently scheduled."
          icon={<CalendarDaysIcon />}
        />
        <DigestSection
          title="Good to Know"
          description="Useful updates that do not need action."
          icon={<InfoIcon />}
        >
          {cancellation ? (
            <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-muted p-2 text-muted-foreground">
                    <InfoIcon className="size-4" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <h3 className="font-semibold tracking-tight">{cancellation.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      The payment Responsibility is no longer outstanding.
                    </p>
                    {child ? (
                      <p className="text-xs font-medium text-muted-foreground">
                        Applies to {child.name}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <details className="group border-t">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium hover:bg-muted/50 sm:px-6 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2">
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    View sources
                  </span>
                  <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <EvidenceTrail communications={demo.communications} claims={cancellation.claims} />
              </details>
            </article>
          ) : null}
        </DigestSection>
      </div>
    </main>
  );
}

function DigestSection({
  title,
  description,
  emptyMessage,
  icon,
  children,
}: {
  title: string;
  description: string;
  emptyMessage?: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
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
      {children ?? (
        <div className="rounded-2xl border border-dashed bg-background px-5 py-6 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

function EvidenceTrail({
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
    <div className="space-y-6 bg-muted/30 px-5 py-6 sm:px-6">
      <div>
        <h4 className="font-medium">How this changed</h4>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          The later cancellation supersedes the earlier swimming activity and its unresolved payment
          Responsibility.
        </p>
      </div>
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
