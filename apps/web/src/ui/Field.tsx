import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface FieldShell {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

export function Input({
  label,
  hint,
  error,
  required,
  id,
  className = "",
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "required"> & FieldShell) {
  const generated = useId();
  const fieldId = id ?? generated;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <div className={`ui-field${error ? " is-invalid" : ""} ${className}`}>
      <label htmlFor={fieldId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error ? (
        <span className="ui-field-error" id={`${fieldId}-error`} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="ui-field-hint" id={`${fieldId}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function Textarea({
  label,
  hint,
  error,
  required,
  id,
  className = "",
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "required"> & FieldShell) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className={`ui-field${error ? " is-invalid" : ""} ${className}`}>
      <label htmlFor={fieldId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <textarea
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...rest}
      />
      {error ? (
        <span className="ui-field-error" id={`${fieldId}-error`} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="ui-field-hint" id={`${fieldId}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function Select({
  label,
  hint,
  error,
  id,
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & FieldShell & { children: ReactNode }) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className={`ui-field${error ? " is-invalid" : ""} ${className}`}>
      <label htmlFor={fieldId}>{label}</label>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <span className="ui-field-error" id={`${fieldId}-error`} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="ui-field-hint" id={`${fieldId}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
