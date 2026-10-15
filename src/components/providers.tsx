"use client";

// Wraps the app with NextAuth's SessionProvider so any client component
// can call useSession() without prop-drilling.

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
