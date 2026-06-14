import { SiGoogle } from "@icons-pack/react-simple-icons";
import { authClient } from "@repo/auth/auth-client";
import { Button } from "@repo/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

interface ContinueWithGoogleButtonProps {
  disabled?: boolean;
  callbackURL: string;
}

export function ContinueWithGoogleButton(props: ContinueWithGoogleButtonProps) {
  const mutation = useMutation({
    mutationFn: async () =>
      await authClient.signIn.social(
        {
          provider: "google",
          callbackURL: props.callbackURL,
        },
        {
          onError: ({ error }) => {
            toast.error(error.message || "Google sign-in could not be started.");
          },
        },
      ),
  });

  return (
    <Button
      variant="secondary"
      className="w-full"
      type="button"
      disabled={mutation.isSuccess || mutation.isPending || props.disabled}
      onClick={() => mutation.mutate()}
    >
      <SiGoogle className="size-4" />
      Continue with Google
    </Button>
  );
}
