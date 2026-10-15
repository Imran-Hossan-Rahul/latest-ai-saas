"use client";

import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base styles shared by all variants
  [
    "inline-flex items-center justify-center gap-2 font-medium select-none",
    "transition-all duration-[150ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-40",
    "active:scale-[0.97]",
  ],
  {
    variants: {
      variant: {
        // Solid accent — primary CTA
        primary: [
          "bg-[rgb(var(--accent))] text-white",
          "hover:bg-[rgb(var(--accent-hover))] hover:shadow-lg hover:shadow-[rgb(var(--accent)/0.3)]",
        ],
        // Glass surface — secondary actions
        ghost: [
          "glass text-[rgb(var(--text-primary))]",
          "hover:bg-white/20 dark:hover:bg-white/10",
        ],
        // Transparent with border
        outline: [
          "border border-[rgb(var(--glass-border))] text-[rgb(var(--text-primary))] bg-transparent",
          "hover:glass",
        ],
        // Destructive
        danger: [
          "bg-[rgb(var(--danger))] text-white",
          "hover:opacity-90 hover:shadow-lg hover:shadow-[rgb(var(--danger)/0.3)]",
        ],
        // Completely invisible — for icon buttons
        bare: "text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]",
      },
      size: {
        sm: "h-8 px-3 text-sm rounded-[10px]",
        md: "h-10 px-4 text-sm rounded-[12px]",
        lg: "h-12 px-6 text-base rounded-[14px]",
        icon: "h-9 w-9 rounded-[10px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** When true, renders as its child element (useful for wrapping <Link>) */
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
