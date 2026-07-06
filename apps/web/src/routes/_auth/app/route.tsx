import { authClient } from "@repo/auth/auth-client";
import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Separator } from "@repo/ui/components/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@repo/ui/components/sidebar";
import { useTheme } from "@repo/ui/lib/theme-provider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import {
  ChevronsUpDownIcon,
  HomeIcon,
  InboxIcon,
  LoaderCircleIcon,
  LogOutIcon,
  MailIcon,
  MessageCircleIcon,
  RefreshCwIcon,
  Repeat2Icon,
  Settings2Icon,
  WifiOffIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { $fetchNewCommunications } from "#/lib/household-digest.functions";
import { needsReauthFromSyncState } from "#/lib/household-sync";
import { $getHouseholdSyncState } from "#/lib/household-sync.functions";

export const Route = createFileRoute("/_auth/app")({
  component: AppLayout,
});

const NAV_ITEMS = [
  { title: "To-do", to: "/app", icon: HomeIcon },
  { title: "Chat", to: "/app/chat", icon: MessageCircleIcon },
  { title: "Digest", to: "/app/digest", icon: InboxIcon },
  { title: "Routines", to: "/app/routines", icon: Repeat2Icon },
  { title: "Sources", to: "/app/sources", icon: Settings2Icon },
] as const;

function isNavItemActive(pathname: string, to: string) {
  return to === "/app" ? pathname === "/app" : pathname.startsWith(to);
}

function AppLayout() {
  const { user } = Route.useRouteContext();
  const { pathname } = useLocation();
  const { fetchMutation, isSyncPolling, needsReauth } = useCommunicationsSync();
  const isSyncing = fetchMutation.isPending || isSyncPolling;

  const activeItem = NAV_ITEMS.find((item) => isNavItemActive(pathname, item.to));
  const pageTitle = activeItem?.title ?? "Comms Digest";

  return (
    <SidebarProvider>
      <AppSidebar name={user.name} email={user.email} pathname={pathname} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
          <h1 className="text-base font-medium tracking-tight">{pageTitle}</h1>
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            disabled={isSyncing}
            onClick={() => fetchMutation.mutate(undefined)}
          >
            {isSyncing ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
            {isSyncPolling ? "Syncing…" : "Fetch new communications"}
          </Button>
        </header>
        {needsReauth ? <ReauthBanner /> : null}
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppSidebar({ name, email, pathname }: { name: string; email: string; pathname: string }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/app" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <MailIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Comms Digest</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isNavItemActive(pathname, item.to)}
                  render={<Link to={item.to} />}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <NavUser name={name} email={email} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavUser({ name, email }: { name: string; email: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
          />
        }
      >
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted text-xs font-medium">
          {name.slice(0, 2).toUpperCase()}
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{email}</span>
        </div>
        <ChevronsUpDownIcon className="ml-auto size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="right" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="space-y-0.5">
            <span className="block font-medium text-foreground">{name}</span>
            <span className="block truncate">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={theme === "light"}
            onCheckedChange={(v) => v && setTheme("light")}
          >
            Light
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={theme === "dark"}
            onCheckedChange={(v) => v && setTheme("dark")}
          >
            Dark
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={theme === "system"}
            onCheckedChange={(v) => v && setTheme("system")}
          >
            System
          </DropdownMenuCheckboxItem>
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

function useCommunicationsSync() {
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

  return { fetchMutation, isSyncPolling, needsReauth };
}

function ReauthBanner() {
  return (
    <div role="alert" className="border-b border-destructive/30 bg-destructive/5">
      <div className="flex w-full items-start gap-3 px-4 py-3 text-sm text-destructive">
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
  );
}
