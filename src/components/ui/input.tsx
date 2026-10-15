"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional icon rendered on the left side */
  leftIcon?: React.ReactNode;
  /** Optional element rendered on the right (e.g. show/hide password toggle) */
  rightElement?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftIcon, rightElement, ...props }, ref) => {
    if (leftIcon || rightElement) {
      return (
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-[rgb(var(--text-muted))] pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full h-10 glass rounded-[12px] text-sm text-[rgb(var(--text-primary))]",
              "placeholder:text-[rgb(var(--text-muted))]",
              "border-[rgb(var(--glass-border))]",
              "transition-all duration-[150ms]",
              "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))] focus:ring-offset-0",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              leftIcon ? "pl-10 pr-4" : "px-4",
              rightElement ? "pr-10" : "",
              className
            )}
            {...props}
          />
          {rightElement && (
            <span className="absolute right-3 text-[rgb(var(--text-muted))]">
              {rightElement}
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        className={cn(
          "w-full h-10 glass rounded-[12px] px-4 text-sm text-[rgb(var(--text-primary))]",
          "placeholder:text-[rgb(var(--text-muted))]",
          "transition-all duration-[150ms]",
          "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))] focus:ring-offset-0",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
