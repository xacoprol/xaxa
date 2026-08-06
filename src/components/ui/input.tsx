import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-stone-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          "flex h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900",
          "placeholder:text-stone-400",
          "focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-400 focus:ring-red-500/20 focus:border-red-400",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";
