"use client";

// GlassPanel — the foundational UI primitive for the liquid-glass design system.
// Every card, modal, sidebar, and panel in the app uses this component.
// Customize depth/radius via props rather than creating one-off glass divs.

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controls border-radius. Defaults to "md" (16px). */
  radius?: "sm" | "md" | "lg" | "xl";
  /** Adds a stronger shadow for elevated panels (modals, popovers). */
  elevated?: boolean;
  /** Removes the glass blur — useful for nested panels to avoid double-blur cost. */
  flat?: boolean;
}

const radiusMap = {
  sm: "rounded-[10px]",
  md: "rounded-[16px]",
  lg: "rounded-[22px]",
  xl: "rounded-[28px]",
};

const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, radius = "md", elevated = false, flat = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base glass styles from globals.css utility class
          flat ? "glass-subtle" : "glass",
          radiusMap[radius],
          // Stronger shadow for elevated surfaces (modals, dropdowns)
          elevated && "shadow-2xl",
          // Smooth transitions for hover/focus states
          "transition-all duration-[220ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassPanel.displayName = "GlassPanel";

export { GlassPanel };
