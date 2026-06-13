import { Button } from "@repo/ui/components/button";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { BookOpenIcon, GraduationCapIcon, PencilIcon, SparklesIcon } from "lucide-react";

import { $getHousehold } from "#/lib/household.functions";

export const Route = createFileRoute("/_auth/app/")({
  loader: async () => {
    const household = await $getHousehold();
    if (!household) {
      throw redirect({ to: "/app/onboarding" });
    }
    return household;
  },
  component: HouseholdHome,
});

function HouseholdHome() {
  const household = Route.useLoaderData();
  const primarySchool = household.schools[0];

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Your Household</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {primarySchool?.name ?? "School communications"}
          </h1>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Your Household is ready. Connecting School Communications comes next.
          </p>
        </div>
        <Button variant="outline" render={<Link to="/app/onboarding" />}>
          <PencilIcon />
          Edit Household
        </Button>
      </div>

      <section aria-labelledby="children-heading">
        <div className="mb-3 flex items-center gap-3">
          <GraduationCapIcon className="size-5 text-muted-foreground" />
          <div>
            <h2 id="children-heading" className="font-semibold tracking-tight">
              Children
            </h2>
            <p className="text-sm text-muted-foreground">
              Used only to match relevant year, class, and named communications.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {household.children.map((householdChild) => (
            <article
              key={householdChild.id}
              className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
            >
              <h3 className="font-semibold tracking-tight">{householdChild.displayName}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {[householdChild.schoolYear, householdChild.className].filter(Boolean).join(" · ")}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="communications-heading"
        className="mt-8 rounded-2xl border border-dashed bg-background p-6 sm:p-8"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-muted p-2 text-muted-foreground">
              <BookOpenIcon className="size-4" />
            </div>
            <div>
              <h2 id="communications-heading" className="font-semibold tracking-tight">
                No School Communications yet
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                Gmail connection and Source Review are the next onboarding steps.
              </p>
            </div>
          </div>
          <Button variant="outline" render={<Link to="/app/demo" />}>
            <SparklesIcon />
            View Demo Digest
          </Button>
        </div>
      </section>
    </main>
  );
}
