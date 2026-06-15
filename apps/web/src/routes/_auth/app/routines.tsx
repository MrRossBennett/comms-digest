import {
  formatRoutineSchedule,
  routineWeekdays,
  type HouseholdRoutine,
  type HouseholdRoutineInput,
} from "@repo/intelligence";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  $deleteHouseholdRoutine,
  $listHouseholdRoutines,
  $saveHouseholdRoutine,
} from "#/lib/household-routine.functions";
import { $getHousehold } from "#/lib/household.functions";

export const Route = createFileRoute("/_auth/app/routines")({
  loader: async () => {
    const [household, routines] = await Promise.all([$getHousehold(), $listHouseholdRoutines()]);
    if (!household) throw redirect({ to: "/app/onboarding" });
    return { household, routines };
  },
  component: HouseholdRoutinesPage,
});

type RoutineFormState = {
  id?: string;
  title: string;
  details: string;
  studentIds: string[];
  schoolId: string;
  weekdays: number[];
  startDate: string;
  endDate: string;
};

const emptyRoutine: RoutineFormState = {
  title: "",
  details: "",
  studentIds: [],
  schoolId: "",
  weekdays: [],
  startDate: "",
  endDate: "",
};

function HouseholdRoutinesPage() {
  const { household, routines } = Route.useLoaderData();
  const router = useRouter();
  const [editingRoutine, setEditingRoutine] = useState<RoutineFormState>();
  const saveMutation = useMutation({
    mutationFn: (data: HouseholdRoutineInput) => $saveHouseholdRoutine({ data }),
    onSuccess: async () => {
      setEditingRoutine(undefined);
      await router.invalidate({ sync: true });
      toast.success("Household Routine saved.");
    },
    onError: () => toast.error("Household Routine could not be saved."),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => $deleteHouseholdRoutine({ data: { id } }),
    onSuccess: async () => {
      setEditingRoutine(undefined);
      await router.invalidate({ sync: true });
      toast.success("Household Routine deleted.");
    },
    onError: () => toast.error("Household Routine could not be deleted."),
  });

  const submitRoutine = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingRoutine || saveMutation.isPending) return;

    saveMutation.mutate({
      id: editingRoutine.id,
      title: editingRoutine.title,
      details: editingRoutine.details || undefined,
      studentIds: editingRoutine.studentIds,
      schoolId: editingRoutine.schoolId || undefined,
      weekdays: editingRoutine.weekdays,
      startDate: editingRoutine.startDate || undefined,
      endDate: editingRoutine.endDate || undefined,
    });
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <Button
        variant="ghost"
        className="mb-6 -ml-3"
        render={<Link to="/app" />}
        nativeButton={false}
      >
        <ArrowLeftIcon />
        Back to Household
      </Button>

      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Household information</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Household Routines</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Add recurring school routines that may not arrive by email. They appear in your Digest
            and can be used by chat.
          </p>
        </div>
        {!editingRoutine ? (
          <Button type="button" onClick={() => setEditingRoutine(emptyRoutine)}>
            <PlusIcon />
            Add Routine
          </Button>
        ) : null}
      </div>

      {editingRoutine ? (
        <RoutineForm
          value={editingRoutine}
          students={household.children}
          schools={household.schools}
          pending={saveMutation.isPending}
          onChange={setEditingRoutine}
          onCancel={() => setEditingRoutine(undefined)}
          onSubmit={submitRoutine}
        />
      ) : null}

      <section className="mt-8" aria-labelledby="saved-routines-heading">
        <div className="mb-3">
          <h2 id="saved-routines-heading" className="font-semibold tracking-tight">
            Saved Routines
          </h2>
          <p className="text-sm text-muted-foreground">
            The next occurrence of each Routine is shown in the Household Digest.
          </p>
        </div>
        {routines.length > 0 ? (
          <div className="grid gap-3">
            {routines.map((routine) => (
              <RoutineCard
                key={routine.id}
                routine={routine}
                students={household.children}
                schools={household.schools}
                pendingDelete={deleteMutation.isPending && deleteMutation.variables === routine.id}
                onEdit={() => setEditingRoutine(formStateFor(routine))}
                onDelete={() => deleteMutation.mutate(routine.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-background p-6 text-sm text-muted-foreground">
            No Household Routines yet.
          </div>
        )}
      </section>
    </main>
  );
}

function RoutineForm({
  value,
  students,
  schools,
  pending,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: RoutineFormState;
  students: Array<{ id: string; displayName: string }>;
  schools: Array<{ id: string; name: string }>;
  pending: boolean;
  onChange: (value: RoutineFormState) => void;
  onCancel: () => void;
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <fieldset disabled={pending} className="grid gap-6">
        <legend className="mb-5 font-semibold tracking-tight">
          {value.id ? "Edit Routine" : "New Routine"}
        </legend>

        <div className="grid gap-2">
          <Label htmlFor="routine-title">Title</Label>
          <Input
            id="routine-title"
            value={value.title}
            onChange={(event) => onChange({ ...value, title: event.target.value })}
            placeholder="PE"
            maxLength={120}
            required
          />
        </div>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium">Applies to</legend>
          <div className="flex flex-wrap gap-2">
            {students.map((student) => {
              const selected = value.studentIds.includes(student.id);
              return (
                <Button
                  key={student.id}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  aria-pressed={selected}
                  onClick={() =>
                    onChange({
                      ...value,
                      studentIds: selected
                        ? value.studentIds.filter((id) => id !== student.id)
                        : [...value.studentIds, student.id],
                    })
                  }
                >
                  {student.displayName}
                </Button>
              );
            })}
          </div>
          {value.studentIds.length === 0 ? (
            <p className="text-xs text-destructive">Choose at least one Student.</p>
          ) : null}
        </fieldset>

        <div className="grid gap-2">
          <Label htmlFor="routine-school">School (optional)</Label>
          <select
            id="routine-school"
            value={value.schoolId}
            onChange={(event) => onChange({ ...value, schoolId: event.target.value })}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">No specific School</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium">Repeats every</legend>
          <div className="flex flex-wrap gap-2">
            {routineWeekdays.map((weekday) => {
              const selected = value.weekdays.includes(weekday.value);
              return (
                <Button
                  key={weekday.value}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  aria-pressed={selected}
                  onClick={() =>
                    onChange({
                      ...value,
                      weekdays: selected
                        ? value.weekdays.filter((day) => day !== weekday.value)
                        : [...value.weekdays, weekday.value],
                    })
                  }
                >
                  {weekday.shortLabel}
                </Button>
              );
            })}
          </div>
          {value.weekdays.length === 0 ? (
            <p className="text-xs text-destructive">Choose at least one weekday.</p>
          ) : null}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="routine-start">Starts (optional)</Label>
            <Input
              id="routine-start"
              type="date"
              value={value.startDate}
              onChange={(event) => onChange({ ...value, startDate: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="routine-end">Ends (optional)</Label>
            <Input
              id="routine-end"
              type="date"
              min={value.startDate || undefined}
              value={value.endDate}
              onChange={(event) => onChange({ ...value, endDate: event.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="routine-details">Additional details (optional)</Label>
          <Textarea
            id="routine-details"
            value={value.details}
            onChange={(event) => onChange({ ...value, details: event.target.value })}
            placeholder="Bring PE kit to school."
            maxLength={1_000}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            <XIcon />
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              !value.title.trim() || value.studentIds.length === 0 || value.weekdays.length === 0
            }
          >
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <CalendarClockIcon />}
            Save Routine
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

function RoutineCard({
  routine,
  students,
  schools,
  pendingDelete,
  onEdit,
  onDelete,
}: {
  routine: HouseholdRoutine;
  students: Array<{ id: string; displayName: string }>;
  schools: Array<{ id: string; name: string }>;
  pendingDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const studentNames = students
    .filter(({ id }) => routine.studentIds.includes(id))
    .map(({ displayName }) => displayName);
  const schoolName = schools.find(({ id }) => id === routine.schoolId)?.name;

  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h3 className="font-semibold tracking-tight">{routine.title}</h3>
          <p className="text-sm text-muted-foreground">
            Every {formatRoutineSchedule(routine.weekdays)}
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            Applies to {formatNames(studentNames)}
            {schoolName ? ` · ${schoolName}` : ""}
          </p>
          {routine.details ? <p className="text-sm leading-6">{routine.details}</p> : null}
        </div>
        <div className="flex gap-2">
          {confirmingDelete ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={pendingDelete}
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pendingDelete}
                onClick={onDelete}
              >
                {pendingDelete ? <LoaderCircleIcon className="animate-spin" /> : <Trash2Icon />}
                Confirm delete
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onEdit}>
                <PencilIcon />
                Edit
              </Button>
              <Button type="button" variant="destructive" onClick={() => setConfirmingDelete(true)}>
                <Trash2Icon />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function formStateFor(routine: HouseholdRoutine): RoutineFormState {
  return {
    id: routine.id,
    title: routine.title,
    details: routine.details ?? "",
    studentIds: routine.studentIds,
    schoolId: routine.schoolId ?? "",
    weekdays: routine.weekdays,
    startDate: routine.startDate ?? "",
    endDate: routine.endDate ?? "",
  };
}

function formatNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "this Household";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
