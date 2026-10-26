import { cn } from "@/lib/cn";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-surface p-5",
        className,
      )}
      {...props}
    />
  );
}

export function Alert({
  variant = "error",
  children,
}: {
  variant?: "error" | "success" | "info" | "warning";
  children: React.ReactNode;
}) {
  const styles = {
    error: "border-danger/30 bg-danger/5 text-danger",
    success: "border-success/30 bg-success/5 text-success",
    info: "border-info/40 bg-info/10 text-ink",
    warning: "border-warning/40 bg-warning/10 text-ink",
  } as const;

  return (
    <div
      role="alert"
      className={cn("rounded-btn border px-3 py-2 text-[13px]", styles[variant])}
    >
      {children}
    </div>
  );
}
