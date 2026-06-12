import { Button } from "@repo/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-2xl space-y-8">
        <div className="space-y-4">
          <p className="text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Comms Digest
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Keep up with what matters.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-pretty text-muted-foreground">
            Turn scattered communications into a clear, useful digest.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button render={<Link to="/signup" />} nativeButton={false}>
            Create account
          </Button>
          <Button render={<Link to="/login" />} variant="outline" nativeButton={false}>
            Sign in
          </Button>
        </div>
      </div>
    </main>
  );
}
