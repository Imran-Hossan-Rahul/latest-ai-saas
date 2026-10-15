"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { Suspense } from "react";

const errorMessages: Record<string, string> = {
  OAuthSignin: "Could not start the sign-in process. Please try again.",
  OAuthCallback: "Something went wrong during sign-in. Please try again.",
  OAuthAccountNotLinked:
    "This email is already registered with a different sign-in method.",
  CredentialsSignin: "Invalid email or password.",
  Default: "An unexpected error occurred. Please try again.",
};

function ErrorContent() {
  const params = useSearchParams();
  const error = params.get("error") ?? "Default";
  const message = errorMessages[error] ?? errorMessages.Default;

  return (
    <GlassPanel radius="xl" elevated className="w-full max-w-md p-8 space-y-5 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[rgb(var(--danger)/0.1)] mx-auto">
        <AlertCircle className="w-6 h-6 text-[rgb(var(--danger))]" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-[rgb(var(--text-primary))]">
          Sign-in error
        </h1>
        <p className="text-sm text-[rgb(var(--text-secondary))]">{message}</p>
      </div>
      <Button asChild size="lg" className="w-full">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </GlassPanel>
  );
}

export default function ErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}
