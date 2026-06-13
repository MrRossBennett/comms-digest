import { Button } from "@repo/ui/components/button";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { MailIcon, PencilIcon, SchoolIcon, SparklesIcon } from "lucide-react";

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

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Your Household</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Schools and Children
          </h1>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            One combined Household Digest across {formatSchoolCount(household.schools.length)}.
          </p>
        </div>
        <Button variant="outline" render={<Link to="/app/onboarding" />}>
          <PencilIcon />
          Edit Household
        </Button>
      </div>

      <section aria-labelledby="schools-heading">
        <div className="mb-3 flex items-center gap-3">
          <SchoolIcon className="size-5 text-muted-foreground" />
          <div>
            <h2 id="schools-heading" className="font-semibold tracking-tight">
              Schools
            </h2>
            <p className="text-sm text-muted-foreground">
              Each Child is matched only against communications from their School.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {household.schools.map((householdSchool) => (
            <article
              key={householdSchool.id}
              className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
            >
              <h3 className="font-semibold tracking-tight">{householdSchool.name}</h3>
              <ul className="mt-3 space-y-2">
                {household.children
                  .filter(({ schoolId }) => schoolId === householdSchool.id)
                  .map((householdChild) => (
                    <li key={householdChild.id} className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {householdChild.displayName}
                      </span>
                      {" · "}
                      {[householdChild.schoolYear, householdChild.className]
                        .filter(Boolean)
                        .join(" · ")}
                    </li>
                  ))}
              </ul>
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
              <MailIcon className="size-4" />
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
          <div className="flex flex-wrap gap-2">
            <Button render={<Link to="/app/sources" />}>
              <MailIcon />
              Review Sources
            </Button>
            <Button variant="outline" render={<Link to="/app/demo" />}>
              <SparklesIcon />
              View Demo Digest
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function formatSchoolCount(count: number) {
  return `${count} ${count === 1 ? "School" : "Schools"}`;
}
