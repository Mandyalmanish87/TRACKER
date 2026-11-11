import { useState, useCallback } from 'react';

export interface ValidationRule<T = any> {
  required?: boolean | string;
  min?: number | { value: number; message: string };
  max?: number | { value: number; message: string };
  minLength?: number | { value: number; message: string };
  maxLength?: number | { value: number; message: string };
  pattern?: RegExp | { regex: RegExp; message: string };
  isDate?: boolean | string;
  isTime?: boolean | string;
  custom?: (value: T, allValues: Record<string, any>) => string | null | undefined;
}

export type FormValidationSchema<T extends Record<string, any>> = {
  [K in keyof T]?: ValidationRule<T[K]>;
};

export interface UseFormValidationReturn<T extends Record<string, any>> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setValues: (values: Partial<T>) => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleBlur: (field: keyof T) => void;
  validateField: (field: keyof T) => boolean;
  validateAll: () => boolean;
  reset: (newValues?: T) => void;
  getFieldProps: (field: keyof T) => {
    name: string;
    id: string;
    value: any;
    onChange: (e: any) => void;
    onBlur: () => void;
    'aria-invalid': boolean;
    'aria-describedby'?: string;
  };
  isValid: boolean;
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  schema: FormValidationSchema<T>
): UseFormValidationReturn<T> {
  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const validateValue = useCallback(
    (field: keyof T, val: any, currentValues: T): string | null => {
      const rule = schema[field];
      if (!rule) return null;

      // 1. Required Check
      if (rule.required) {
        const isEmpty =
          val === undefined ||
          val === null ||
          (typeof val === 'string' && val.trim() === '') ||
          (Array.isArray(val) && val.length === 0);
        if (isEmpty) {
          return typeof rule.required === 'string' ? rule.required : 'This field is required.';
        }
      }

      // If value is empty and not required, pass
      if (val === undefined || val === null || val === '') {
        return null;
      }

      // 2. Min / Max for numbers
      if (typeof val === 'number') {
        if (rule.min !== undefined) {
          const minVal = typeof rule.min === 'number' ? rule.min : rule.min.value;
          const minMsg = typeof rule.min === 'object' ? rule.min.message : `Value must be at least ${minVal}.`;
          if (val < minVal) return minMsg;
        }
        if (rule.max !== undefined) {
          const maxVal = typeof rule.max === 'number' ? rule.max : rule.max.value;
          const maxMsg = typeof rule.max === 'object' ? rule.max.message : `Value must be at most ${maxVal}.`;
          if (val > maxVal) return maxMsg;
        }
      }

      // 3. String length checks
      if (typeof val === 'string') {
        if (rule.minLength !== undefined) {
          const minL = typeof rule.minLength === 'number' ? rule.minLength : rule.minLength.value;
          const msg = typeof rule.minLength === 'object' ? rule.minLength.message : `Must be at least ${minL} characters.`;
          if (val.trim().length < minL) return msg;
        }
        if (rule.maxLength !== undefined) {
          const maxL = typeof rule.maxLength === 'number' ? rule.maxLength : rule.maxLength.value;
          const msg = typeof rule.maxLength === 'object' ? rule.maxLength.message : `Must not exceed ${maxL} characters.`;
          if (val.trim().length > maxL) return msg;
        }
      }

      // 4. Time format check (HH:MM 24-hour)
      if (rule.isTime && typeof val === 'string') {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(val.trim())) {
          return typeof rule.isTime === 'string' ? rule.isTime : 'Invalid time format (use HH:MM).';
        }
      }

      // 5. Date check (YYYY-MM-DD)
      if (rule.isDate && typeof val === 'string') {
        const d = new Date(val);
        if (isNaN(d.getTime())) {
          return typeof rule.isDate === 'string' ? rule.isDate : 'Invalid date.';
        }
      }

      // 6. Pattern check
      if (rule.pattern && typeof val === 'string') {
        const regex = 'regex' in rule.pattern ? rule.pattern.regex : rule.pattern;
        const msg = 'message' in rule.pattern ? rule.pattern.message : 'Invalid format.';
        if (!regex.test(val)) return msg;
      }

      // 7. Custom validation
      if (rule.custom) {
        const customRes = rule.custom(val, currentValues);
        if (customRes) return customRes;
      }

      return null;
    },
    [schema]
  );

  const setValue = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setValuesState((prev) => {
        const next = { ...prev, [field]: value };
        if (touched[field]) {
          const error = validateValue(field, value, next);
          setErrors((errs) => ({ ...errs, [field]: error || undefined }));
        }
        return next;
      });
    },
    [touched, validateValue]
  );

  const setValues = useCallback(
    (newVals: Partial<T>) => {
      setValuesState((prev) => ({ ...prev, ...newVals }));
    },
    []
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      const parsedValue = type === 'number' ? (value === '' ? '' : Number(value)) : value;
      setValue(name as keyof T, parsedValue as any);
    },
    [setValue]
  );

  const handleBlur = useCallback(
    (field: keyof T) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const error = validateValue(field, values[field], values);
      setErrors((errs) => ({ ...errs, [field]: error || undefined }));
    },
    [values, validateValue]
  );

  const validateField = useCallback(
    (field: keyof T): boolean => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const error = validateValue(field, values[field], values);
      setErrors((errs) => ({ ...errs, [field]: error || undefined }));
      return !error;
    },
    [values, validateValue]
  );

  const validateAll = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    const newTouched: Partial<Record<keyof T, boolean>> = {};
    let isAllValid = true;

    for (const key of Object.keys(schema) as Array<keyof T>) {
      newTouched[key] = true;
      const error = validateValue(key, values[key], values);
      if (error) {
        newErrors[key] = error;
        isAllValid = false;
      }
    }

    setTouched(newTouched);
    setErrors(newErrors);
    return isAllValid;
  }, [schema, values, validateValue]);

  const reset = useCallback(
    (newValues?: T) => {
      setValuesState(newValues || initialValues);
      setErrors({});
      setTouched({});
    },
    [initialValues]
  );

  const getFieldProps = useCallback(
    (field: keyof T) => {
      const error = errors[field];
      const isFieldTouched = touched[field];
      const hasError = Boolean(isFieldTouched && error);
      const strField = String(field);

      return {
        name: strField,
        id: `form-field-${strField}`,
        value: values[field] ?? '',
        onChange: handleChange,
        onBlur: () => handleBlur(field),
        'aria-invalid': hasError,
        'aria-describedby': hasError ? `form-field-error-${strField}` : undefined,
      };
    },
    [values, errors, touched, handleChange, handleBlur]
  );

  const isValid = Object.values(errors).filter(Boolean).length === 0;

  return {
    values,
    errors,
    touched,
    setValue,
    setValues,
    handleChange,
    handleBlur,
    validateField,
    validateAll,
    reset,
    getFieldProps,
    isValid,
  };
}
