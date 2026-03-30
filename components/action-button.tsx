import { cn } from "@/lib/utils"
import { ButtonHTMLAttributes } from "react"

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary"
}

export function ActionButton({ variant = "primary", className, children, ...props }: ActionButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "flex items-center gap-1 pl-4 pr-3.5 py-2 text-[13px] font-medium transition-opacity cursor-pointer",
        variant === "primary"
          ? "bg-foreground text-background hover:opacity-80"
          : "border border-[#D3D3D3] dark:border-border bg-background text-foreground opacity-60 hover:opacity-80",
        className
      )}
    >
      {children}
    </button>
  )
}
