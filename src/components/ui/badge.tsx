import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border px-[11px] py-1 text-[11px] font-medium leading-[1.4] tracking-[-0.004em] transition-[border-color,background-color,color,box-shadow] duration-150 focus:outline-none focus:shadow-focus",
  {
    variants: {
      variant: {
        default: "border-primary/10 bg-primary/[0.06] text-primary",
        secondary: "border-border bg-secondary/80 text-secondary-foreground",
        destructive: "border-destructive/20 bg-destructive/[0.06] text-destructive",
        outline: "text-foreground border-border",
        success: "border-success/20 bg-success/[0.06] text-success",
        info: "border-info/20 bg-info/[0.06] text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
