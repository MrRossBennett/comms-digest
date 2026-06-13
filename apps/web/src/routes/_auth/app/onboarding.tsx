import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon, LoaderCircleIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { $getHousehold, $saveHousehold } from "#/lib/household.functions";

export const Route = createFileRoute("/_auth/app/onboarding")({
  loader: () => $getHousehold(),
  component: HouseholdOnboarding,
});

function HouseholdOnboarding() {
  const existingHousehold = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const [schoolName, setSchoolName] = useState(existingHousehold?.schools[0]?.name ?? "");
  const [householdChildren, setHouseholdChildren] = useState(() =>
    existingHousehold?.children.length
      ? existingHousehold.children.map((householdChild) => ({
          displayName: householdChild.displayName,
          schoolYear: householdChild.schoolYear,
          className: householdChild.className ?? "",
        }))
      : [{ displayName: "", schoolYear: "", className: "" }],
  );
  const saveMutation = useMutation({
    mutationFn: $saveHousehold,
    onSuccess: async () => {
      await router.invalidate({ sync: true });
      await navigate({ to: "/app" });
    },
    onError: () => {
      toast.error("We could not save your Household. Please try again.");
    },
  });

  const updateChild = (
    index: number,
    field: "displayName" | "schoolYear" | "className",
    value: string,
  ) => {
    setHouseholdChildren((current) =>
      current.map((householdChild, childIndex) =>
        childIndex === index ? { ...householdChild, [field]: value } : householdChild,
      ),
    );
  };

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saveMutation.isPending) return;

    saveMutation.mutate({
      data: {
        schoolName,
        children: householdChildren,
      },
    });
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      {existingHousehold ? (
        <Button variant="ghost" className="mb-6 -ml-3" render={<Link to="/app" />}>
          <ArrowLeftIcon />
          Back to Household
        </Button>
      ) : null}

      <div className="mb-8 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">
          {existingHousehold ? "Household settings" : "Set up your Household"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Who should this Digest understand?
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Add only the details needed to match School Communications. A first name or nickname is
          enough; do not enter surnames or dates of birth.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="grid gap-2">
            <Label htmlFor="school-name">School</Label>
            <Input
              id="school-name"
              value={schoolName}
              onChange={(event) => setSchoolName(event.target.value)}
              placeholder="Riverside Primary"
              autoComplete="organization"
              readOnly={saveMutation.isPending}
              required
            />
          </div>
        </section>

        <section aria-labelledby="household-children-heading">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 id="household-children-heading" className="font-semibold tracking-tight">
                Children
              </h2>
              <p className="text-sm text-muted-foreground">
                Class is optional because most communications are year-based.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() =>
                setHouseholdChildren((current) => [
                  ...current,
                  { displayName: "", schoolYear: "", className: "" },
                ])
              }
            >
              <PlusIcon />
              Add Child
            </Button>
          </div>

          <div className="grid gap-4">
            {householdChildren.map((householdChild, index) => (
              <fieldset
                key={index}
                className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
                disabled={saveMutation.isPending}
              >
                <legend className="sr-only">Child {index + 1}</legend>
                <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                  <div className="grid gap-2">
                    <Label htmlFor={`child-${index}-name`}>Name</Label>
                    <Input
                      id={`child-${index}-name`}
                      value={householdChild.displayName}
                      onChange={(event) => updateChild(index, "displayName", event.target.value)}
                      placeholder="First name or nickname"
                      autoComplete="off"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`child-${index}-year`}>School year</Label>
                    <Input
                      id={`child-${index}-year`}
                      value={householdChild.schoolYear}
                      onChange={(event) => updateChild(index, "schoolYear", event.target.value)}
                      placeholder="Year 4"
                      autoComplete="off"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`child-${index}-class`}>Class (optional)</Label>
                    <Input
                      id={`child-${index}-class`}
                      value={householdChild.className}
                      onChange={(event) => updateChild(index, "className", event.target.value)}
                      placeholder="4B"
                      autoComplete="off"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove Child ${index + 1}`}
                    disabled={householdChildren.length === 1}
                    onClick={() =>
                      setHouseholdChildren((current) =>
                        current.filter((_, childIndex) => childIndex !== index),
                      )
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </fieldset>
            ))}
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button variant="ghost" render={<Link to="/app/demo" />}>
            Preview Demo Household
          </Button>
          <Button type="submit" size="lg" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <LoaderCircleIcon className="animate-spin" /> : null}
            {saveMutation.isPending
              ? "Saving Household..."
              : existingHousehold
                ? "Save changes"
                : "Create Household"}
          </Button>
        </div>
      </form>
    </main>
  );
}
