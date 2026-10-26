import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Boutons du design system (spec/07-design-system.md).
 *
 * Le orange #FFA633 ne sert jamais de couleur de texte : soit fond avec texte
 * foncé (primaire), soit bordure/accent avec texte foncé. Raison : contraste.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-btn text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-brand text-ink hover:bg-brand-dark",
        secondary:
          "border border-line bg-surface text-ink hover:bg-app",
        ghost: "text-body hover:bg-app hover:text-ink",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4",
        lg: "h-11 w-full px-5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
