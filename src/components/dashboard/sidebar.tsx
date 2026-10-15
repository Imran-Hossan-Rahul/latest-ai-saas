"use client";

// Sidebar — persistent left navigation for the dashboard.
// Uses Next.js usePathname to highlight the active route.
// Collapses to icon-only on smaller screens.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { MessageSquare, BarChart2, Settings, CreditCard, LogOut, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: Bot },
  { href: "/dashboard/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/dashboard/pages", label: "Pages", icon: Bot },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <GlassPanel
      flat
      radius="sm"
      className="w-60 h-full flex flex-col py-5 px-3 border-r border-[rgb(var(--glass-border))] rounded-none shrink-0"
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-3 mb-6">
        <div className="w-8 h-8 rounded-[10px] bg-[rgb(var(--accent))] flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold">S</span>
        </div>
        <span className="font-semibold text-[rgb(var(--text-primary))]">SalesBot AI</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          // Exact match for overview, prefix match for sub-routes
          const isActive =
            href === "/dashboard" ? pathname === href : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-sm font-medium",
                "transition-all duration-[150ms]",
                isActive
                  ? "bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]"
                  : "text-[rgb(var(--text-secondary))] hover:bg-white/10 hover:text-[rgb(var(--text-primary))]"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-[rgb(var(--glass-border))] pt-4 mt-4 space-y-2">
        <div className="flex items-center gap-2.5 px-3 py-1">
          {session?.user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt={session.user.name ?? "User"}
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[rgb(var(--accent)/0.2)] flex items-center justify-center">
              <span className="text-xs font-medium text-[rgb(var(--accent))]">
                {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[rgb(var(--text-primary))] truncate">
              {session?.user?.name ?? "User"}
            </p>
            <p className="text-xs text-[rgb(var(--text-muted))] truncate">
              {session?.user?.email}
            </p>
          </div>
        </div>

        <Button
          variant="bare"
          size="sm"
          className="w-full justify-start gap-3 px-3"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>
    </GlassPanel>
  );
}
