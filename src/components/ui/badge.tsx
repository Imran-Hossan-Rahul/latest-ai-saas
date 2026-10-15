import { cn } from "@/lib/utils";

const variants = {
  ai: "bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent))] border-[rgb(var(--accent)/0.3)]",
  human: "bg-[rgb(var(--success)/0.15)] text-[rgb(var(--success))] border-[rgb(var(--success)/0.3)]",
  closed: "bg-[rgb(var(--text-muted)/0.15)] text-[rgb(var(--text-muted))] border-[rgb(var(--text-muted)/0.3)]",
  hot_lead: "bg-[rgb(var(--warning)/0.15)] text-[rgb(var(--warning))] border-[rgb(var(--warning)/0.3)]",
  spam: "bg-[rgb(var(--danger)/0.15)] text-[rgb(var(--danger))] border-[rgb(var(--danger)/0.3)]",
  default: "bg-[rgb(var(--text-muted)/0.1)] text-[rgb(var(--text-secondary))] border-[rgb(var(--text-muted)/0.2)]",
};

interface BadgeProps {
  variant?: keyof typeof variants;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
