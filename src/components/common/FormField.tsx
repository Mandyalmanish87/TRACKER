import React from 'react';
import { AlertCircle } from 'lucide-react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  touched?: boolean;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  error,
  touched,
  required,
  hint,
  className = '',
  children,
}) => {
  const showError = Boolean(touched && error);

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={htmlFor}
          className="block text-xs font-semibold text-espresso-800 dark:text-ivory-100 tracking-tight"
        >
          {label}
          {required && <span className="text-rose-500 ml-1" aria-hidden="true">*</span>}
        </label>
        {hint && !showError && (
          <span className="text-[11px] text-espresso-400 dark:text-espresso-500">{hint}</span>
        )}
      </div>

      <div>{children}</div>

      {showError && (
        <p
          id={htmlFor ? `form-field-error-${htmlFor}` : undefined}
          role="alert"
          className="flex items-center gap-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400 pt-0.5 animate-in fade-in duration-150"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
