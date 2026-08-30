import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[transform,box-shadow,border-color,background-color,color] duration-200 ease-via-snap focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-0 active:scale-[0.985]",
  {
    variants: {
      variant: {
        default: "border border-primary bg-primary text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.16),0_6px_14px_-8px_var(--via-shadow-ink-40)] hover:-translate-y-px hover:bg-primary/94 hover:shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.16),0_12px_24px_-10px_var(--via-shadow-ink-40)]",
        destructive: "border border-destructive/25 bg-destructive/5 text-destructive hover:-translate-y-px hover:border-destructive/45 hover:bg-destructive hover:text-destructive-foreground",
        outline: "border border-border bg-card text-foreground shadow-[inset_0_1px_0_var(--via-edge-hi)] hover:-translate-y-px hover:border-primary/20 hover:bg-secondary",
        secondary: "border border-border/70 bg-secondary text-secondary-foreground hover:-translate-y-px hover:border-primary/15 hover:bg-secondary/80",
        ghost: "text-muted-foreground hover:text-foreground hover:bg-secondary",
        link: "text-primary underline-offset-4 hover:underline",
        accent: "border border-primary bg-primary text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.16)] hover:-translate-y-px hover:bg-primary/94 hover:shadow-card-hover",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
