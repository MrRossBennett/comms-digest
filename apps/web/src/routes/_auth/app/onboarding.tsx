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
  const [householdSchools, setHouseholdSchools] = useState(() =>
    existingHousehold?.schools.length
      ? existingHousehold.schools.map((householdSchool) => ({
          key: householdSchool.id,
          name: householdSchool.name,
        }))
      : [{ key: "school-1", name: "" }],
  );
  const [householdChildren, setHouseholdChildren] = useState(() =>
    existingHousehold?.children.length
      ? existingHousehold.children.map((householdChild) => ({
          key: householdChild.id,
          displayName: householdChild.displayName,
          schoolYear: householdChild.schoolYear,
          className: householdChild.className ?? "",
          schoolKey: householdChild.schoolId,
        }))
      : [
          {
            key: "child-1",
            displayName: "",
            schoolYear: "",
            className: "",
            schoolKey: "school-1",
          },
        ],
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
    field: "displayName" | "schoolYear" | "className" | "schoolKey",
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
        schools: householdSchools,
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
        <section aria-labelledby="household-schools-heading">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 id="household-schools-heading" className="font-semibold tracking-tight">
                Schools
              </h2>
              <p className="text-sm text-muted-foreground">
                Add every School attended by a Child in this Household.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() =>
                setHouseholdSchools((current) => [
                  ...current,
                  { key: `school-${Date.now()}`, name: "" },
                ])
              }
            >
              <PlusIcon />
              Add School
            </Button>
          </div>

          <div className="grid gap-4">
            {householdSchools.map((householdSchool, index) => {
              const hasAssignedChildren = householdChildren.some(
                ({ schoolKey }) => schoolKey === householdSchool.key,
              );

              return (
                <fieldset
                  key={householdSchool.key}
                  className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
                  disabled={saveMutation.isPending}
                >
                  <legend className="sr-only">School {index + 1}</legend>
                  <div className="flex items-end gap-3">
                    <div className="grid flex-1 gap-2">
                      <Label htmlFor={`school-${index}-name`}>School name</Label>
                      <Input
                        id={`school-${index}-name`}
                        value={householdSchool.name}
                        onChange={(event) =>
                          setHouseholdSchools((current) =>
                            current.map((candidate) =>
                              candidate.key === householdSchool.key
                                ? { ...candidate, name: event.target.value }
                                : candidate,
                            ),
                          )
                        }
                        placeholder="Riverside Primary"
                        autoComplete="organization"
                        required
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove School ${index + 1}`}
                      disabled={householdSchools.length === 1 || hasAssignedChildren}
                      onClick={() =>
                        setHouseholdSchools((current) =>
                          current.filter(({ key }) => key !== householdSchool.key),
                        )
                      }
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </fieldset>
              );
            })}
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
                  {
                    key: `child-${Date.now()}`,
                    displayName: "",
                    schoolYear: "",
                    className: "",
                    schoolKey: householdSchools[0]?.key ?? "",
                  },
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
                key={householdChild.key}
                className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
                disabled={saveMutation.isPending}
              >
                <legend className="sr-only">Child {index + 1}</legend>
                <div className="grid gap-4 sm:grid-cols-2">
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
                    <Label htmlFor={`child-${index}-school`}>School</Label>
                    <select
                      id={`child-${index}-school`}
                      value={householdChild.schoolKey}
                      onChange={(event) => updateChild(index, "schoolKey", event.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                      required
                    >
                      {householdSchools.map((householdSchool) => (
                        <option key={householdSchool.key} value={householdSchool.key}>
                          {householdSchool.name || "Unnamed School"}
                        </option>
                      ))}
                    </select>
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
                  <div className="flex justify-end sm:col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={householdChildren.length === 1}
                      onClick={() =>
                        setHouseholdChildren((current) =>
                          current.filter((_, childIndex) => childIndex !== index),
                        )
                      }
                    >
                      <Trash2Icon />
                      Remove Child
                    </Button>
                  </div>
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
