import { authClient } from "@repo/auth/auth-client";
import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useRouter } from "@tanstack/react-router";
import {
  HomeIcon,
  InboxIcon,
  LoaderCircleIcon,
  LogOutIcon,
  MenuIcon,
  MessageCircleIcon,
  RefreshCwIcon,
  Settings2Icon,
  UserIcon,
  WifiOffIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ThemeToggle } from "#/components/theme-toggle";
import { $fetchNewCommunications } from "#/lib/household-digest.functions";
import { needsReauthFromSyncState } from "#/lib/household-sync";
import { $getHouseholdSyncState } from "#/lib/household-sync.functions";

export const Route = createFileRoute("/_auth/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5 sm:px-8">
          <div>
            <p className="font-semibold tracking-tight">Comms Digest</p>
          </div>
          <div className="flex items-center gap-2">
            <MobileNavigation />
            <nav className="hidden items-center gap-1 sm:flex" aria-label="Main navigation">
              <Button variant="ghost" size="sm" render={<Link to="/app" />} nativeButton={false}>
                <HomeIcon />
                Today's to-dos
              </Button>
              <Button
                variant="ghost"
                size="sm"
                render={<Link to="/app/chat" />}
                nativeButton={false}
              >
                <MessageCircleIcon />
                Chat
              </Button>
            </nav>
            <ThemeToggle />
            <AccountMenu name={user.name} email={user.email} />
          </div>
        </div>
      </header>
      <SyncBar />
      <Outlet />
    </div>
  );
}

function SyncBar() {
  const router = useRouter();
  const [isSyncPolling, setIsSyncPolling] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);

  useEffect(() => {
    $getHouseholdSyncState().then((state) => {
      if (needsReauthFromSyncState(state)) setNeedsReauth(true);
    });
  }, []);

  useEffect(() => {
    if (!isSyncPolling) return;
    let cancelled = false;
    const poll = async () => {
      const state = await $getHouseholdSyncState();
      if (cancelled) return;
      if (state?.needsReauth) {
        setNeedsReauth(true);
        setIsSyncPolling(false);
        return;
      }
      if (state?.status !== "running") {
        setIsSyncPolling(false);
        await router.invalidate({ sync: true });
        toast.success("Digest updated.");
        return;
      }
      setTimeout(poll, 3_000);
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [isSyncPolling, router]);

  const fetchMutation = useMutation({
    mutationFn: $fetchNewCommunications,
    onSuccess: async (result) => {
      if (result.syncing) {
        setIsSyncPolling(true);
        return;
      }
      await router.invalidate({ sync: true });
      toast.success(
        result.importedCount === 0
          ? "Digest is already up to date."
          : `Added ${result.importedCount} new ${result.importedCount === 1 ? "communication" : "communications"}.`,
      );
    },
    onError: () => {
      toast.error("Communications could not be fetched.");
    },
  });

  return (
    <>
      <div className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-5xl items-center px-5 py-2.5 sm:px-8">
          <Button
            type="button"
            size="sm"
            disabled={fetchMutation.isPending || isSyncPolling}
            onClick={() => fetchMutation.mutate(undefined)}
          >
            {fetchMutation.isPending || isSyncPolling ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <RefreshCwIcon />
            )}
            {isSyncPolling ? "Syncing…" : "Fetch new communications"}
          </Button>
        </div>
      </div>
      {needsReauth ? (
        <div role="alert" className="border-b border-destructive/30 bg-destructive/5">
          <div className="mx-auto flex w-full max-w-5xl items-start gap-3 px-5 py-3 text-sm text-destructive sm:px-8">
            <WifiOffIcon className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Gmail connection needs reconnecting</p>
              <p className="mt-1 text-destructive/80">
                Your Gmail access has expired or been revoked. Reconnect from{" "}
                <Link className="underline underline-offset-2" to="/app/sources">
                  Sources
                </Link>{" "}
                to resume automatic sync.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MobileNavigation() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="sm:hidden"
            aria-label="Open navigation"
          />
        }
      >
        <MenuIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 sm:hidden">
        <DropdownMenuItem render={<Link to="/app" />}>
          <HomeIcon />
          Today's to-dos
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/app/chat" />}>
          <MessageCircleIcon />
          Chat
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenu({ name, email }: { name: string; email: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon" aria-label="Open account menu" />}
      >
        <UserIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="space-y-0.5">
            <span className="block font-medium text-foreground">{name}</span>
            <span className="block truncate">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link to="/app/digest" />}>
            <InboxIcon />
            Digest
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/app/sources" />}>
            <Settings2Icon />
            Sources
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            await authClient.signOut({
              fetchOptions: {
                onResponse: async () => {
                  queryClient.setQueryData(authQueryOptions().queryKey, null);
                  await router.invalidate();
                },
              },
            });
          }}
        >
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
