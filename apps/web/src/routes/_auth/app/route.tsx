import { authClient } from "@repo/auth/auth-client";
import { authQueryOptions } from "@repo/auth/tanstack/queries";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { LogOutIcon, UserIcon } from "lucide-react";

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
            <p className="text-xs text-muted-foreground">Demo Household</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AccountMenu name={user.name} email={user.email} />
          </div>
        </div>
      </header>
      <Outlet />
    </div>
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
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block font-medium text-foreground">{name}</span>
          <span className="block truncate">{email}</span>
        </DropdownMenuLabel>
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
