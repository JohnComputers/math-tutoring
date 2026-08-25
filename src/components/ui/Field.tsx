import { type ReactNode, forwardRef, useId } from 'react';
import { Icon } from './Icon';

/**
 * Form field wrappers that wire up accessibility by construction.
 *
 * Every field gets a real `<label for>`, and hint/error text is linked through
 * `aria-describedby` so a screen reader reads the error *with* the field rather than
 * leaving a blind user to guess which input turned red. Doing this in one place means no
 * individual form can forget it.
 */

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  children,
  className = '',
}: FieldShellProps) {
  return (
    <div className={`field ${className}`.trim()}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && (
          <span className="field__required" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${id}-error`}>
          <Icon name="info" size={14} />
          {error}
        </p>
      )}
    </div>
  );
}

/** ids for aria-describedby, skipping the ones that are not rendered. */
function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  const parts: string[] = [];
  if (error) parts.push(`${id}-error`);
  else if (hint) parts.push(`${id}-hint`);
  return parts.length ? parts.join(' ') : undefined;
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  wrapperClassName?: string;
};

export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField(
  { label, hint, error, required, wrapperClassName, className = '', ...rest },
  ref,
) {
  const id = useId();
  return (
    <FieldShell
      id={id}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={wrapperClassName ?? ''}
    >
      <input
        {...rest}
        ref={ref}
        id={id}
        required={required}
        className={`input ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
      />
    </FieldShell>
  );
});

type TextAreaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  wrapperClassName?: string;
};

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextAreaField(
    { label, hint, error, required, wrapperClassName, className = '', ...rest },
    ref,
  ) {
    const id = useId();
    return (
      <FieldShell
        id={id}
        label={label}
        required={required}
        hint={hint}
        error={error}
        className={wrapperClassName ?? ''}
      >
        <textarea
          {...rest}
          ref={ref}
          id={id}
          required={required}
          className={`textarea ${className}`.trim()}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
        />
      </FieldShell>
    );
  },
);

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  wrapperClassName?: string;
  children: ReactNode;
};

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
  { label, hint, error, required, wrapperClassName, className = '', children, ...rest },
  ref,
) {
  const id = useId();
  return (
    <FieldShell
      id={id}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={wrapperClassName ?? ''}
    >
      <select
        {...rest}
        ref={ref}
        id={id}
        required={required}
        className={`select ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
      >
        {children}
      </select>
    </FieldShell>
  );
});

interface CheckboxFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  error?: string;
  name?: string;
}

export function CheckboxField({
  checked,
  onChange,
  children,
  error,
  name,
}: CheckboxFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label className="checkbox" htmlFor={id}>
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span className="checkbox__text">{children}</span>
      </label>
      {error && (
        <p className="field__error" id={`${id}-error`}>
          <Icon name="info" size={14} />
          {error}
        </p>
      )}
    </div>
  );
}

interface ToggleFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/** A switch-styled boolean, for the admin settings screens. */
export function ToggleField({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: ToggleFieldProps) {
  const id = useId();
  return (
    <div className="toggle-field">
      <div className="toggle-field__text">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        {hint && (
          <p className="field__hint" id={`${id}-hint`}>
            {hint}
          </p>
        )}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`toggle ${checked ? 'is-on' : ''}`.trim()}
      >
        <span className="toggle__thumb" aria-hidden="true" />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}
