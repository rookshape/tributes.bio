import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { forwardRef, useId } from "react";
import { cn } from "../../lib/cn";

type FieldShellProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Rendered opposite the label — counters, "optional", inline actions. */
  trailing?: ReactNode;
  className?: string;
  htmlFor?: string;
  children: ReactNode;
};

/** Label + control + hint/error. Use directly when wrapping a custom control. */
export function FieldShell({
  label,
  hint,
  error,
  trailing,
  className,
  htmlFor,
  children,
}: FieldShellProps) {
  return (
    <div className={cn("w-full", className)}>
      {label || trailing ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label ? (
            <label className="text-detail font-medium text-content-muted" htmlFor={htmlFor}>
              {label}
            </label>
          ) : (
            <span />
          )}
          {trailing ? (
            <span className="text-caption text-content-subtle">{trailing}</span>
          ) : null}
        </div>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1.5 text-caption text-critical">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-caption text-content-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

type ControlExtras = Pick<FieldShellProps, "label" | "hint" | "error" | "trailing"> & {
  /** Class applied to the wrapper, not the control. */
  fieldClassName?: string;
};

export type InputProps = InputHTMLAttributes<HTMLInputElement> &
  ControlExtras & {
    /** Rendered inside the control's leading edge, e.g. a currency symbol. */
    prefix?: ReactNode;
  };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, trailing, fieldClassName, prefix, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const control = (
    <input
      {...rest}
      aria-invalid={error ? true : undefined}
      className={cn("field", !!prefix && "pl-8", !!error && "border-critical", className)}
      id={inputId}
      ref={ref}
    />
  );

  return (
    <FieldShell
      className={fieldClassName}
      error={error}
      hint={hint}
      htmlFor={inputId}
      label={label}
      trailing={trailing}
    >
      {prefix ? (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-content-subtle">
            {prefix}
          </span>
          {control}
        </div>
      ) : (
        control
      )}
    </FieldShell>
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & ControlExtras;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, trailing, fieldClassName, className, id, rows = 4, ...rest },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <FieldShell
      className={fieldClassName}
      error={error}
      hint={hint}
      htmlFor={textareaId}
      label={label}
      trailing={trailing}
    >
      <textarea
        {...rest}
        aria-invalid={error ? true : undefined}
        className={cn("field resize-y", !!error && "border-critical", className)}
        id={textareaId}
        ref={ref}
        rows={rows}
      />
    </FieldShell>
  );
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & ControlExtras;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, trailing, fieldClassName, className, id, children, ...rest },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <FieldShell
      className={fieldClassName}
      error={error}
      hint={hint}
      htmlFor={selectId}
      label={label}
      trailing={trailing}
    >
      <select
        {...rest}
        aria-invalid={error ? true : undefined}
        className={cn("field cursor-pointer pr-8", !!error && "border-critical", className)}
        id={selectId}
        ref={ref}
      >
        {children}
      </select>
    </FieldShell>
  );
});
