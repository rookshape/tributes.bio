import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";

export type ButtonVariant =
  | "primary"
  | "accent"
  | "secondary"
  | "ghost"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary: "primary-button",
  accent: "blue-button",
  secondary: "secondary-button",
  ghost: "ghost-button",
  danger: "danger-button",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "min-h-8 px-3 text-detail",
  md: "min-h-10 px-4",
  lg: "min-h-12 px-5 text-lead",
};

type SharedProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretches the button to the width of its container. */
  block?: boolean;
  /** Shows a spinner and blocks interaction without changing the button width. */
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  className?: string;
  children?: ReactNode;
};

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
    />
  );
}

function content({ loading, iconLeft, iconRight, children }: SharedProps) {
  return (
    <>
      {loading ? <Spinner /> : iconLeft}
      {children}
      {loading ? null : iconRight}
    </>
  );
}

function classes({ variant = "primary", size = "md", block, className }: SharedProps) {
  return cn(variantClass[variant], sizeClass[size], block && "w-full", className);
}

export type ButtonProps = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, loading, iconLeft, iconRight, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      aria-busy={loading || undefined}
      className={classes({ variant, size, block, className })}
      disabled={disabled || loading}
      ref={ref}
      type={type}
    >
      {content({ loading, iconLeft, iconRight, children })}
    </button>
  );
});

export type ButtonLinkProps = SharedProps & {
  to: string;
  "aria-label"?: string;
  title?: string;
  target?: string;
  rel?: string;
};

/** Router link styled as a button. Use for navigation, not actions. */
export function ButtonLink({
  to,
  variant,
  size,
  block,
  loading,
  iconLeft,
  iconRight,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  const external = /^https?:/.test(to);
  const inner = content({ loading, iconLeft, iconRight, children });
  const style = classes({ variant, size, block, className });

  if (external) {
    return (
      <a {...rest} className={style} href={to}>
        {inner}
      </a>
    );
  }

  return (
    <Link {...rest} className={style} to={to}>
      {inner}
    </Link>
  );
}

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** Required — icon-only controls have no visible text to announce. */
  label: string;
  icon: ReactNode;
  size?: "sm" | "md";
  className?: string;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, icon, size = "md", className, type = "button", ...rest }, ref) {
    return (
      <button
        {...rest}
        aria-label={label}
        className={cn("icon-button", size === "sm" && "h-8 w-8", className)}
        ref={ref}
        title={rest.title ?? label}
        type={type}
      >
        {icon}
      </button>
    );
  },
);
