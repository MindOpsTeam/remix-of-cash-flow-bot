import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-md border border-input bg-[hsl(var(--input-bg))] px-3.5 py-3 text-sm text-foreground shadow-[inset_0_1px_0_var(--via-edge-hi)] transition-[border-color,background-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:bg-card focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.1)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
