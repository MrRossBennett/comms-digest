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
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useRouter } from "@tanstack/react-router";
import { HomeIcon, LogOutIcon, MenuIcon, MessageCircleIcon, UserIcon } from "lucide-react";

import { ThemeToggle } from "#/components/theme-toggle";

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
                Household
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
      <Outlet />
    </div>
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
          Household
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
